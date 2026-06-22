package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSecurityHeaders_SetsExpectedHeaders(t *testing.T) {
	handler := SecurityHeaders()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	res := rec.Result()

	if got := res.Header.Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("expected X-Content-Type-Options=nosniff, got %q", got)
	}
	if got := res.Header.Get("Content-Security-Policy"); got == "" {
		t.Fatalf("expected Content-Security-Policy to be set")
	}
	if got := res.Header.Get("X-Frame-Options"); got != "DENY" {
		t.Fatalf("expected X-Frame-Options=DENY, got %q", got)
	}
	if got := res.Header.Get("Referrer-Policy"); got != "no-referrer" {
		t.Fatalf("expected Referrer-Policy=no-referrer, got %q", got)
	}
	if got := res.Header.Get("Permissions-Policy"); got == "" {
		t.Fatalf("expected Permissions-Policy to be set")
	}
	if got := res.Header.Get("Cross-Origin-Opener-Policy"); got != "same-origin" {
		t.Fatalf("expected Cross-Origin-Opener-Policy=same-origin, got %q", got)
	}
	if got := res.Header.Get("Cross-Origin-Resource-Policy"); got != "same-origin" {
		t.Fatalf("expected Cross-Origin-Resource-Policy=same-origin, got %q", got)
	}
	if got := res.Header.Get("Origin-Agent-Cluster"); got != "?1" {
		t.Fatalf("expected Origin-Agent-Cluster=?1, got %q", got)
	}
	if got := res.Header.Get("X-DNS-Prefetch-Control"); got != "off" {
		t.Fatalf("expected X-DNS-Prefetch-Control=off, got %q", got)
	}
}

func TestSecurityHeaders_SetsHSTSOnHTTPSRequests(t *testing.T) {
	handler := SecurityHeaders("10.0.0.0/8")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	req.RemoteAddr = "10.0.0.5:1234"
	req.Header.Set("X-Forwarded-Proto", "https")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if got := rec.Result().Header.Get("Strict-Transport-Security"); got == "" {
		t.Fatalf("expected Strict-Transport-Security to be set on https requests")
	}
}

func TestSecurityHeaders_IgnoresForwardedProtoFromUntrustedClients(t *testing.T) {
	handler := SecurityHeaders()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	req.RemoteAddr = "198.51.100.10:1234"
	req.Header.Set("X-Forwarded-Proto", "https")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if got := rec.Result().Header.Get("Strict-Transport-Security"); got != "" {
		t.Fatalf("expected Strict-Transport-Security to be omitted for untrusted forwarded proto, got %q", got)
	}
}

func TestNoStore_SetsCacheHeaders(t *testing.T) {
	handler := NoStore()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	res := rec.Result()

	if got := res.Header.Get("Cache-Control"); got != "no-store, max-age=0" {
		t.Fatalf("expected Cache-Control no-store, got %q", got)
	}
	if got := res.Header.Get("Pragma"); got != "no-cache" {
		t.Fatalf("expected Pragma no-cache, got %q", got)
	}
	if got := res.Header.Get("Expires"); got != "0" {
		t.Fatalf("expected Expires 0, got %q", got)
	}
}

func TestRateLimiter_BlocksAfterLimit(t *testing.T) {
	limiter := NewRateLimiter(1, time.Minute)
	handler := limiter.Handler()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	firstReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	firstReq.RemoteAddr = "127.0.0.1:1234"
	firstRec := httptest.NewRecorder()
	handler.ServeHTTP(firstRec, firstReq)

	if firstRec.Result().StatusCode != http.StatusNoContent {
		t.Fatalf("expected first request to pass, got %d", firstRec.Result().StatusCode)
	}

	secondReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	secondReq.RemoteAddr = "127.0.0.1:1234"
	secondRec := httptest.NewRecorder()
	handler.ServeHTTP(secondRec, secondReq)

	if secondRec.Result().StatusCode != http.StatusTooManyRequests {
		t.Fatalf("expected second request to be rate limited, got %d", secondRec.Result().StatusCode)
	}

	if secondRec.Result().Header.Get("Retry-After") == "" {
		t.Fatalf("expected Retry-After header to be set")
	}
}
