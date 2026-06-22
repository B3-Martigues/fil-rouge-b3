package middleware

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"time"
)

type rateLimitEntry struct {
	count      int
	windowEnds time.Time
}

type rateLimitStore interface {
	Allow(ctx context.Context, key string, limit int, window time.Duration) (int, bool, error)
}

type rateLimitKeyBuilder func(*http.Request, []netip.Prefix) (string, bool, error)

type compositeReadCloser struct {
	io.Reader
	io.Closer
}

type memoryRateLimitStore struct {
	mu      sync.Mutex
	entries map[string]rateLimitEntry
}

type dbRateLimitStore struct {
	db            *sql.DB
	cleanupMu     sync.Mutex
	lastCleanupAt time.Time
}

type RateLimiter struct {
	limit              int
	window             time.Duration
	store              rateLimitStore
	buildKey           rateLimitKeyBuilder
	trustedProxyRanges []netip.Prefix
}

// Cree un rate limiter memoire avec cle par defaut basee sur IP + route.
func NewRateLimiter(limit int, window time.Duration, trustedProxyCIDRs ...string) *RateLimiter {
	return NewRateLimiterWithKeyBuilder(limit, window, nil, trustedProxyCIDRs...)
}

// Cree un rate limiter memoire avec strategie de cle personnalisable.
func NewRateLimiterWithKeyBuilder(limit int, window time.Duration, buildKey rateLimitKeyBuilder, trustedProxyCIDRs ...string) *RateLimiter {
	if buildKey == nil {
		buildKey = defaultRateLimitKey
	}

	return &RateLimiter{
		limit:              limit,
		window:             window,
		buildKey:           buildKey,
		trustedProxyRanges: parseTrustedProxyRanges(trustedProxyCIDRs),
		store: &memoryRateLimitStore{
			entries: make(map[string]rateLimitEntry),
		},
	}
}

// Cree un rate limiter persistant en base si possible, sinon retombe sur la memoire.
func NewDBRateLimiter(db *sql.DB, limit int, window time.Duration, trustedProxyCIDRs ...string) *RateLimiter {
	return NewDBRateLimiterWithKeyBuilder(db, limit, window, nil, trustedProxyCIDRs...)
}

// Variante persistante avec constructeur de cle personnalise.
func NewDBRateLimiterWithKeyBuilder(
	db *sql.DB,
	limit int,
	window time.Duration,
	buildKey rateLimitKeyBuilder,
	trustedProxyCIDRs ...string,
) *RateLimiter {
	if db == nil {
		return NewRateLimiterWithKeyBuilder(limit, window, buildKey, trustedProxyCIDRs...)
	}

	if buildKey == nil {
		buildKey = defaultRateLimitKey
	}

	return &RateLimiter{
		limit:              limit,
		window:             window,
		store:              &dbRateLimitStore{db: db},
		buildKey:           buildKey,
		trustedProxyRanges: parseTrustedProxyRanges(trustedProxyCIDRs),
	}
}

// Retourne le middleware HTTP qui applique la politique de limitation configuree.
func (r *RateLimiter) Handler() func(http.Handler) http.Handler {
	if r == nil || r.limit <= 0 || r.window <= 0 || r.store == nil {
		return func(next http.Handler) http.Handler { return next }
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			keyBuilder := r.buildKey
			if keyBuilder == nil {
				keyBuilder = defaultRateLimitKey
			}

			key, shouldLimit, err := keyBuilder(req, r.trustedProxyRanges)
			if err != nil {
				writeJSONError(w, http.StatusBadRequest, "invalid rate limit key")
				return
			}
			if !shouldLimit {
				next.ServeHTTP(w, req)
				return
			}

			retryAfter, allowed, err := r.store.Allow(req.Context(), key, r.limit, r.window)
			if err != nil {
				writeJSONError(w, http.StatusInternalServerError, "internal error")
				return
			}
			if !allowed {
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				writeJSONError(w, http.StatusTooManyRequests, "too many requests")
				return
			}

			next.ServeHTTP(w, req)
		})
	}
}

// Cle standard de limitation : client resolu + chemin HTTP.
func defaultRateLimitKey(req *http.Request, trustedProxyRanges []netip.Prefix) (string, bool, error) {
	return clientIP(req, trustedProxyRanges) + "|" + req.URL.Path, true, nil
}

// Construit une cle de limitation plus stricte pour la connexion en incluant l'email cible.
func LoginEmailRateLimitKey(maxBodyBytes int64) rateLimitKeyBuilder {
	return loginEmailRateLimitKey(maxBodyBytes, true)
}

// Construit une cle de limitation par compte, independante de l'IP cliente.
func LoginEmailOnlyRateLimitKey(maxBodyBytes int64) rateLimitKeyBuilder {
	return loginEmailRateLimitKey(maxBodyBytes, false)
}

func loginEmailRateLimitKey(maxBodyBytes int64, includeClientIP bool) rateLimitKeyBuilder {
	if maxBodyBytes <= 0 {
		maxBodyBytes = 8 << 10
	}

	return func(req *http.Request, trustedProxyRanges []netip.Prefix) (string, bool, error) {
		if req == nil || req.Body == nil {
			return "", false, nil
		}

		originalBody := req.Body
		rawBody, err := io.ReadAll(io.LimitReader(originalBody, maxBodyBytes+1))
		if err != nil {
			return "", false, err
		}
		if int64(len(rawBody)) > maxBodyBytes {
			req.Body = compositeReadCloser{
				Reader: io.MultiReader(bytes.NewReader(rawBody), originalBody),
				Closer: originalBody,
			}
			return "", false, nil
		}

		closeErr := originalBody.Close()
		req.Body = io.NopCloser(bytes.NewReader(rawBody))
		if closeErr != nil {
			return "", false, closeErr
		}

		var payload struct {
			Email string `json:"email"`
		}
		if err := json.Unmarshal(rawBody, &payload); err != nil {
			return "", false, nil
		}

		email := strings.TrimSpace(strings.ToLower(payload.Email))
		if email == "" {
			return "", false, nil
		}

		if includeClientIP {
			return clientIP(req, trustedProxyRanges) + "|" + req.URL.Path + "|email:" + email, true, nil
		}

		return req.URL.Path + "|email:" + email, true, nil
	}
}

// Stockage memoire simple par fenetre discrete.
func (s *memoryRateLimitStore) Allow(_ context.Context, key string, limit int, window time.Duration) (int, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	for currentKey, entry := range s.entries {
		if now.After(entry.windowEnds) {
			delete(s.entries, currentKey)
		}
	}

	entry, ok := s.entries[key]
	if !ok || now.After(entry.windowEnds) {
		s.entries[key] = rateLimitEntry{
			count:      1,
			windowEnds: now.Add(window),
		}
		return 0, true, nil
	}

	if entry.count >= limit {
		retryAfter := int(time.Until(entry.windowEnds).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		return retryAfter, false, nil
	}

	entry.count++
	s.entries[key] = entry
	return 0, true, nil
}

// Stockage persistant du rate limiting dans PostgreSQL.
func (s *dbRateLimitStore) Allow(ctx context.Context, key string, limit int, window time.Duration) (int, bool, error) {
	s.maybeCleanup(ctx, window)

	const query = `
		WITH upserted AS (
			INSERT INTO http_rate_limits (bucket_key, request_count, window_started_at, updated_at)
			VALUES ($1, 1, NOW(), NOW())
			ON CONFLICT (bucket_key)
			DO UPDATE SET
				request_count = CASE
					WHEN http_rate_limits.window_started_at <= NOW() - $2::interval THEN 1
					ELSE http_rate_limits.request_count + 1
				END,
				window_started_at = CASE
					WHEN http_rate_limits.window_started_at <= NOW() - $2::interval THEN NOW()
					ELSE http_rate_limits.window_started_at
				END,
				updated_at = NOW()
			RETURNING request_count, window_started_at
		)
		SELECT request_count, window_started_at
		FROM upserted
	`

	var (
		requestCount  int
		windowStarted time.Time
	)
	if err := s.db.QueryRowContext(ctx, query, key, intervalLiteral(window)).Scan(&requestCount, &windowStarted); err != nil {
		return 0, false, err
	}

	if requestCount <= limit {
		return 0, true, nil
	}

	retryAfter := int((window - time.Since(windowStarted)).Seconds())
	if retryAfter < 1 {
		retryAfter = 1
	}

	return retryAfter, false, nil
}

// Purge periodiquement les buckets expires de la table SQL.
func (s *dbRateLimitStore) maybeCleanup(ctx context.Context, window time.Duration) {
	if s == nil || s.db == nil {
		return
	}

	const cleanupInterval = 5 * time.Minute
	const minRetention = time.Hour

	retention := window
	if retention < minRetention {
		retention = minRetention
	}

	now := time.Now()

	s.cleanupMu.Lock()
	if !s.lastCleanupAt.IsZero() && now.Sub(s.lastCleanupAt) < cleanupInterval {
		s.cleanupMu.Unlock()
		return
	}
	s.lastCleanupAt = now
	s.cleanupMu.Unlock()

	_, _ = s.db.ExecContext(
		ctx,
		`DELETE FROM http_rate_limits WHERE updated_at < NOW() - $1::interval`,
		intervalLiteral(retention),
	)
}

// Determine l'IP cliente reelle en tenant compte des proxies de confiance.
func clientIP(r *http.Request, trustedProxyRanges []netip.Prefix) string {
	remoteIP, fallback := remoteRequestIP(r.RemoteAddr)
	if remoteIP == "" {
		return fallback
	}

	if !isTrustedProxy(remoteIP, trustedProxyRanges) {
		return remoteIP
	}

	forwardedChain := forwardedIPChain(r.Header.Get("X-Forwarded-For"))
	if len(forwardedChain) == 0 {
		if ip := normalizeIP(r.Header.Get("X-Real-IP")); ip != "" {
			return ip
		}

		return remoteIP
	}

	candidate := remoteIP
	for index := len(forwardedChain) - 1; index >= 0; index-- {
		if !isTrustedProxy(candidate, trustedProxyRanges) {
			break
		}
		candidate = forwardedChain[index]
	}

	return candidate
}

// Parse la chaine X-Forwarded-For en liste d'IP normalisees.
func forwardedIPChain(headerValue string) []string {
	result := make([]string, 0)
	for _, part := range strings.Split(headerValue, ",") {
		if ip := normalizeIP(part); ip != "" {
			result = append(result, ip)
		}
	}

	return result
}

// Nettoie et normalise une IP eventuellement accompagnee d'un port.
func normalizeIP(candidate string) string {
	value := strings.TrimSpace(candidate)
	if value == "" {
		return ""
	}

	if host, _, err := net.SplitHostPort(value); err == nil && host != "" {
		value = host
	}

	value = strings.Trim(value, "[]")
	if ip := net.ParseIP(value); ip != nil {
		return ip.String()
	}

	return ""
}

// Extrait l'IP distante depuis RemoteAddr.
func remoteRequestIP(remoteAddr string) (string, string) {
	trimmedRemoteAddr := strings.TrimSpace(remoteAddr)
	if trimmedRemoteAddr == "" {
		return "", "unknown"
	}

	host, _, err := net.SplitHostPort(trimmedRemoteAddr)
	if err == nil && host != "" {
		if ip := normalizeIP(host); ip != "" {
			return ip, host
		}

		return "", host
	}

	if ip := normalizeIP(trimmedRemoteAddr); ip != "" {
		return ip, trimmedRemoteAddr
	}

	return "", trimmedRemoteAddr
}

// Parse toutes les plages proxy de confiance declarees.
func parseTrustedProxyRanges(entries []string) []netip.Prefix {
	ranges := make([]netip.Prefix, 0, len(entries))
	for _, entry := range entries {
		if prefix, ok := parseTrustedProxyEntry(entry); ok {
			ranges = append(ranges, prefix)
		}
	}

	return ranges
}

// Parse une entree proxy individuelle en prefixe netip.
func parseTrustedProxyEntry(entry string) (netip.Prefix, bool) {
	trimmed := strings.TrimSpace(entry)
	if trimmed == "" {
		return netip.Prefix{}, false
	}

	if strings.Contains(trimmed, "/") {
		prefix, err := netip.ParsePrefix(trimmed)
		if err != nil {
			return netip.Prefix{}, false
		}

		return prefix.Masked(), true
	}

	addr, err := netip.ParseAddr(trimmed)
	if err != nil {
		return netip.Prefix{}, false
	}

	return netip.PrefixFrom(addr, addr.BitLen()), true
}

// Indique si une IP appartient a l'une des plages proxy de confiance.
func isTrustedProxy(ip string, trustedProxyRanges []netip.Prefix) bool {
	if len(trustedProxyRanges) == 0 {
		return false
	}

	addr, err := netip.ParseAddr(ip)
	if err != nil {
		return false
	}

	for _, prefix := range trustedProxyRanges {
		if prefix.Contains(addr) {
			return true
		}
	}

	return false
}

// Formate une duree Go en literal SQL reutilisable.
func intervalLiteral(window time.Duration) string {
	return fmt.Sprintf("%f seconds", window.Seconds())
}
