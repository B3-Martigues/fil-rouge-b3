package middleware

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestClientIP_IgnoresForwardedHeadersByDefault(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	req.RemoteAddr = "10.0.0.5:41234"
	req.Header.Set("X-Forwarded-For", "203.0.113.10, 10.0.0.5")

	if got := clientIP(req, nil); got != "10.0.0.5" {
		t.Fatalf("expected remote address to be used by default, got %q", got)
	}
}

func TestClientIP_UsesForwardedHeadersFromTrustedProxyChain(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	req.RemoteAddr = "10.0.0.5:41234"
	req.Header.Set("X-Forwarded-For", "203.0.113.10, 198.51.100.2")

	trustedProxyRanges := parseTrustedProxyRanges([]string{"10.0.0.0/8", "198.51.100.0/24"})
	if got := clientIP(req, trustedProxyRanges); got != "203.0.113.10" {
		t.Fatalf("expected trusted proxy chain to resolve original client IP, got %q", got)
	}
}

func TestNewRateLimiter_BlocksRequestsOverTheLimit(t *testing.T) {
	limiter := NewRateLimiter(2, time.Minute)
	store := limiter.store

	if _, allowed, err := store.Allow(context.Background(), "203.0.113.10|/api/auth/login", 2, time.Minute); err != nil || !allowed {
		t.Fatalf("expected first request to be allowed, allowed=%v err=%v", allowed, err)
	}
	if _, allowed, err := store.Allow(context.Background(), "203.0.113.10|/api/auth/login", 2, time.Minute); err != nil || !allowed {
		t.Fatalf("expected second request to be allowed, allowed=%v err=%v", allowed, err)
	}

	retryAfter, allowed, err := store.Allow(context.Background(), "203.0.113.10|/api/auth/login", 2, time.Minute)
	if err != nil {
		t.Fatalf("expected third request to fail without store error, got %v", err)
	}
	if allowed {
		t.Fatalf("expected third request to be rate limited")
	}
	if retryAfter < 1 {
		t.Fatalf("expected positive retry-after, got %d", retryAfter)
	}
}

func TestLoginEmailRateLimitKey_UsesNormalizedEmailAndRestoresBody(t *testing.T) {
	keyBuilder := LoginEmailRateLimitKey(8 << 10)
	body := []byte(`{"email":"  USER@Example.com  ","password":"secret-value"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.RemoteAddr = "203.0.113.10:41234"

	key, shouldLimit, err := keyBuilder(req, nil)
	if err != nil {
		t.Fatalf("expected key extraction to succeed, got %v", err)
	}
	if !shouldLimit {
		t.Fatalf("expected login email limiter to apply")
	}
	if key != "203.0.113.10|/api/auth/login|email:user@example.com" {
		t.Fatalf("unexpected rate limit key %q", key)
	}

	restoredBody, err := io.ReadAll(req.Body)
	if err != nil {
		t.Fatalf("read restored request body: %v", err)
	}
	if string(restoredBody) != string(body) {
		t.Fatalf("expected request body to be restored, got %q", restoredBody)
	}
}

func TestLoginEmailOnlyRateLimitKey_DoesNotIncludeClientIP(t *testing.T) {
	keyBuilder := LoginEmailOnlyRateLimitKey(8 << 10)
	body := []byte(`{"email":"  USER@Example.com  ","password":"secret-value"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.RemoteAddr = "203.0.113.10:41234"

	key, shouldLimit, err := keyBuilder(req, nil)
	if err != nil {
		t.Fatalf("expected key extraction to succeed, got %v", err)
	}
	if !shouldLimit {
		t.Fatalf("expected login email-only limiter to apply")
	}
	if key != "/api/auth/login|email:user@example.com" {
		t.Fatalf("unexpected rate limit key %q", key)
	}
}

func TestLoginEmailRateLimitKey_SkipsRequestsWithoutEmail(t *testing.T) {
	keyBuilder := LoginEmailRateLimitKey(8 << 10)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"password":"secret-value"}`))

	key, shouldLimit, err := keyBuilder(req, nil)
	if err != nil {
		t.Fatalf("expected missing email to be ignored without error, got %v", err)
	}
	if shouldLimit {
		t.Fatalf("expected limiter to skip requests without an email key, got key %q", key)
	}
	if key != "" {
		t.Fatalf("expected empty key when limiter is skipped, got %q", key)
	}
}

func TestLoginEmailRateLimitKey_PreservesOversizedBodyWhenSkipping(t *testing.T) {
	keyBuilder := LoginEmailRateLimitKey(16)
	body := []byte(`{"email":"user@example.com","password":"secret-value"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))

	key, shouldLimit, err := keyBuilder(req, nil)
	if err != nil {
		t.Fatalf("expected oversized body to be skipped without error, got %v", err)
	}
	if shouldLimit || key != "" {
		t.Fatalf("expected oversized body to skip limiter, key=%q shouldLimit=%v", key, shouldLimit)
	}

	restoredBody, err := io.ReadAll(req.Body)
	if err != nil {
		t.Fatalf("read restored oversized request body: %v", err)
	}
	if string(restoredBody) != string(body) {
		t.Fatalf("expected oversized request body to be preserved, got %q", restoredBody)
	}
}
