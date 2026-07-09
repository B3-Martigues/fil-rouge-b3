package geocoding

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"mappening/internal/cache"
	"mappening/internal/httpx"
)

const (
	minSuggestionQueryRunes = 3
	defaultSuggestionLimit  = 5
	maxSuggestionLimit      = 8
	suggestionCacheTTL      = 2 * time.Minute
)

type Suggester interface {
	Suggest(ctx context.Context, query string, limit int) ([]Result, error)
}

type SuggestionCache interface {
	Get(ctx context.Context, key string) ([]Result, bool)
	Set(ctx context.Context, key string, suggestions []Result, ttl time.Duration)
}

type Handler struct {
	Suggester Suggester
	Cache     SuggestionCache
}

type redisSuggestionCache struct {
	client *cache.Client
}

type memorySuggestionCache struct {
	mu      sync.Mutex
	entries map[string]memorySuggestionCacheEntry
}

type memorySuggestionCacheEntry struct {
	suggestions []Result
	expiresAt   time.Time
}

func NewSuggestionCache(client *cache.Client) SuggestionCache {
	if client == nil {
		return &memorySuggestionCache{entries: map[string]memorySuggestionCacheEntry{}}
	}

	return redisSuggestionCache{client: client}
}

func (c redisSuggestionCache) Get(ctx context.Context, key string) ([]Result, bool) {
	raw, err := c.client.Get(ctx, key).Result()
	if err != nil {
		if err != redis.Nil {
			log.Warn().Err(err).Msg("address suggestion cache read failed")
		}
		return nil, false
	}

	var suggestions []Result
	if err := json.Unmarshal([]byte(raw), &suggestions); err != nil {
		log.Warn().Err(err).Msg("address suggestion cache decode failed")
		return nil, false
	}

	return suggestions, true
}

func (c redisSuggestionCache) Set(ctx context.Context, key string, suggestions []Result, ttl time.Duration) {
	payload, err := json.Marshal(suggestions)
	if err != nil {
		log.Warn().Err(err).Msg("address suggestion cache encode failed")
		return
	}

	if err := c.client.Set(ctx, key, payload, ttl).Err(); err != nil {
		log.Warn().Err(err).Msg("address suggestion cache write failed")
	}
}

func (c *memorySuggestionCache) Get(_ context.Context, key string) ([]Result, bool) {
	if c == nil {
		return nil, false
	}

	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[key]
	if !ok {
		return nil, false
	}
	if now.After(entry.expiresAt) {
		delete(c.entries, key)
		return nil, false
	}

	return cloneResults(entry.suggestions), true
}

func (c *memorySuggestionCache) Set(_ context.Context, key string, suggestions []Result, ttl time.Duration) {
	if c == nil || ttl <= 0 {
		return
	}

	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()

	for currentKey, entry := range c.entries {
		if now.After(entry.expiresAt) {
			delete(c.entries, currentKey)
		}
	}

	c.entries[key] = memorySuggestionCacheEntry{
		suggestions: cloneResults(suggestions),
		expiresAt:   now.Add(ttl),
	}
}

func (h Handler) Suggest(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if len([]rune(query)) < minSuggestionQueryRunes {
		httpx.WriteJSON(w, http.StatusOK, []Result{})
		return
	}

	limit := defaultSuggestionLimit
	if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil || parsedLimit < 0 {
			httpx.WriteJSONError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = normalizeSuggestionLimit(parsedLimit)
	}

	if h.Suggester == nil {
		httpx.WriteJSON(w, http.StatusOK, []Result{})
		return
	}

	cacheKey := suggestionCacheKey(query, limit)
	if h.Cache != nil {
		if suggestions, ok := h.Cache.Get(r.Context(), cacheKey); ok {
			httpx.WriteJSON(w, http.StatusOK, suggestions)
			return
		}
	}

	suggestions, err := h.Suggester.Suggest(r.Context(), query, limit)
	if err != nil {
		log.Error().Err(err).Msg("address suggestions failed")
		httpx.WriteJSONError(w, http.StatusBadGateway, "address suggestion service unavailable")
		return
	}

	if h.Cache != nil {
		h.Cache.Set(r.Context(), cacheKey, suggestions, suggestionCacheTTL)
	}

	httpx.WriteJSON(w, http.StatusOK, suggestions)
}

func RegisterRoutes(r chi.Router, handler Handler) {
	r.Get("/api/geocoding/suggestions", handler.Suggest)
}

func normalizeSuggestionLimit(limit int) int {
	if limit <= 0 {
		return defaultSuggestionLimit
	}
	if limit > maxSuggestionLimit {
		return maxSuggestionLimit
	}
	return limit
}

func suggestionCacheKey(query string, limit int) string {
	values := url.Values{}
	values.Set("q", strings.ToLower(strings.TrimSpace(query)))
	values.Set("limit", strconv.Itoa(normalizeSuggestionLimit(limit)))

	return "geocoding:suggestions:" + values.Encode()
}

func cloneResults(results []Result) []Result {
	if results == nil {
		return nil
	}

	cloned := make([]Result, len(results))
	copy(cloned, results)
	return cloned
}
