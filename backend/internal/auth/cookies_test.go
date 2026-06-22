package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSetAuthCookies_FlagsAndPaths(t *testing.T) {
	rec := httptest.NewRecorder()

	accessExp := time.Now().Add(10 * time.Minute)
	refreshExp := time.Now().Add(7 * 24 * time.Hour)

	setAuthCookies(
		rec,
		"access-abc", accessExp,
		"refresh-def", refreshExp,
		CookieOpts{Secure: false},
	)

	res := rec.Result()
	cookies := res.Cookies()

	acc := findCookie(cookies, "access_token")
	ref := findCookie(cookies, "refresh_token")

	if acc == nil || ref == nil {
		t.Fatalf("expected access_token and refresh_token cookies to be set")
	}

	if acc.Path != "/" {
		t.Fatalf("access_token Path expected '/', got %q", acc.Path)
	}
	if ref.Path != "/api/auth" {
		t.Fatalf("refresh_token Path expected '/api/auth', got %q", ref.Path)
	}

	if !acc.HttpOnly {
		t.Fatalf("access_token must be HttpOnly")
	}
	if !ref.HttpOnly {
		t.Fatalf("refresh_token must be HttpOnly")
	}

	if acc.SameSite != http.SameSiteLaxMode {
		t.Fatalf("access_token SameSite expected Lax, got %v", acc.SameSite)
	}
	if ref.SameSite != http.SameSiteLaxMode {
		t.Fatalf("refresh_token SameSite expected Lax, got %v", ref.SameSite)
	}

	if acc.Value == "" || ref.Value == "" {
		t.Fatalf("expected cookie values to be set")
	}
	if acc.MaxAge <= 0 {
		t.Fatalf("access_token MaxAge expected > 0, got %d", acc.MaxAge)
	}
	if ref.MaxAge <= 0 {
		t.Fatalf("refresh_token MaxAge expected > 0, got %d", ref.MaxAge)
	}
}

func TestSetCsrfCookie_NotHttpOnly(t *testing.T) {
	rec := httptest.NewRecorder()

	exp := time.Now().Add(1 * time.Hour)
	setCsrfCookie(rec, "csrf-xyz", exp, CookieOpts{Secure: false})

	res := rec.Result()
	csrf := findCookie(res.Cookies(), "csrf_token")
	if csrf == nil {
		t.Fatalf("expected csrf_token cookie to be set")
	}
	if csrf.HttpOnly {
		t.Fatalf("csrf_token must NOT be HttpOnly")
	}
	if csrf.Path != "/" {
		t.Fatalf("csrf_token Path expected '/', got %q", csrf.Path)
	}
	if csrf.SameSite != http.SameSiteLaxMode {
		t.Fatalf("csrf_token SameSite expected Lax, got %v", csrf.SameSite)
	}
	if csrf.MaxAge <= 0 {
		t.Fatalf("csrf_token MaxAge expected > 0, got %d", csrf.MaxAge)
	}
}

func TestSetCsrfCookie_UsesConfiguredDomain(t *testing.T) {
	rec := httptest.NewRecorder()

	exp := time.Now().Add(1 * time.Hour)
	setCsrfCookie(rec, "csrf-xyz", exp, CookieOpts{Secure: true, CSRFCookieDomain: "example.com"})

	csrf := findCookie(rec.Result().Cookies(), "csrf_token")
	if csrf == nil {
		t.Fatalf("expected csrf_token cookie to be set")
	}
	if csrf.Domain != "example.com" {
		t.Fatalf("expected csrf_token Domain example.com, got %q", csrf.Domain)
	}
	if !csrf.Secure {
		t.Fatalf("expected csrf_token to inherit Secure flag")
	}
}

func TestClearAuthCookies_SetsMaxAgeMinus1(t *testing.T) {
	rec := httptest.NewRecorder()
	clearAuthCookies(rec, CookieOpts{Secure: false})

	res := rec.Result()
	cookies := res.Cookies()

	acc := findCookie(cookies, "access_token")
	ref := findCookie(cookies, "refresh_token")
	csrf := findCookie(cookies, "csrf_token")

	if acc == nil || ref == nil || csrf == nil {
		t.Fatalf("expected access_token, refresh_token, csrf_token to be cleared")
	}

	if acc.MaxAge != -1 {
		t.Fatalf("access_token MaxAge expected -1, got %d", acc.MaxAge)
	}
	if ref.MaxAge != -1 {
		t.Fatalf("refresh_token MaxAge expected -1, got %d", ref.MaxAge)
	}
	if csrf.MaxAge != -1 {
		t.Fatalf("csrf_token MaxAge expected -1, got %d", csrf.MaxAge)
	}
	if !acc.Expires.Before(time.Now().Add(1 * time.Second)) {
		t.Fatalf("access_token Expires expected to be in the past, got %v", acc.Expires)
	}
	if !ref.Expires.Before(time.Now().Add(1 * time.Second)) {
		t.Fatalf("refresh_token Expires expected to be in the past, got %v", ref.Expires)
	}
	if !csrf.Expires.Before(time.Now().Add(1 * time.Second)) {
		t.Fatalf("csrf_token Expires expected to be in the past, got %v", csrf.Expires)
	}
}

func findCookie(cookies []*http.Cookie, name string) *http.Cookie {
	for _, c := range cookies {
		if c.Name == name {
			return c
		}
	}
	return nil
}
