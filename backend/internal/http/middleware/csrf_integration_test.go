package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCsrfProtect_SkipsLoginPrefix(t *testing.T) {
	mw := CsrfProtect(CsrfOptions{
		CookieName:  "csrf_token",
		HeaderName:  "X-CSRF-Token",
		SkipPaths:   []string{"/api/auth/login"},
		FrontendURL: "http://localhost:5173",
	})

	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	})

	h := mw(next)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Result().StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Result().StatusCode)
	}
	if !called {
		t.Fatalf("expected next handler to be called")
	}
}

func TestCsrfProtect_RequiresOrigin(t *testing.T) {
	mw := CsrfProtect(CsrfOptions{
		CookieName:  "csrf_token",
		HeaderName:  "X-CSRF-Token",
		SkipPaths:   []string{"/api/auth/login"},
		FrontendURL: "http://localhost:5173",
	})

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	h := mw(next)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	// Pas d'Origin, pas de Referer
	req.AddCookie(&http.Cookie{Name: "csrf_token", Value: "abc"})

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Result().StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Result().StatusCode)
	}
}

func TestCsrfProtect_RequiresHeaderAndCookieMatch(t *testing.T) {
	mw := CsrfProtect(CsrfOptions{
		CookieName:  "csrf_token",
		HeaderName:  "X-CSRF-Token",
		SkipPaths:   []string{"/api/auth/login"},
		FrontendURL: "http://localhost:5173",
	})

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	h := mw(next)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.AddCookie(&http.Cookie{Name: "csrf_token", Value: "cookie-token"})

	// header manquant => 403
	{
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req.Clone(req.Context()))
		if rec.Result().StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 on missing header, got %d", rec.Result().StatusCode)
		}
	}

	// header différent => 403
	{
		req2 := req.Clone(req.Context())
		req2.Header.Set("X-CSRF-Token", "other")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req2)
		if rec.Result().StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 on mismatch, got %d", rec.Result().StatusCode)
		}
	}

	// header identique => next appelé
	{
		req3 := req.Clone(req.Context())
		req3.Header.Set("X-CSRF-Token", "cookie-token")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req3)
		if rec.Result().StatusCode != http.StatusNoContent {
			t.Fatalf("expected 204 when ok, got %d", rec.Result().StatusCode)
		}
	}
}

func TestCsrfProtect_RejectsRefererThatOnlySharesStringPrefix(t *testing.T) {
	mw := CsrfProtect(CsrfOptions{
		CookieName:  "csrf_token",
		HeaderName:  "X-CSRF-Token",
		SkipPaths:   []string{"/api/auth/login"},
		FrontendURL: "http://localhost:5173",
	})

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	h := mw(next)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	req.Header.Set("Referer", "http://localhost:5173.attacker.example/evil")
	req.AddCookie(&http.Cookie{Name: "csrf_token", Value: "cookie-token"})
	req.Header.Set("X-CSRF-Token", "cookie-token")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Result().StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for referer with matching string prefix only, got %d", rec.Result().StatusCode)
	}
}
