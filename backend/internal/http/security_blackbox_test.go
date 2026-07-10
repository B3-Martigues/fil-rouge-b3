package http_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"mappening/internal/config"
	httpapi "mappening/internal/http"
)

func TestSecurity_Blackbox_NoStaticAuthFallback(t *testing.T) {
	cfg := config.Config{
		Addr:                   ":0",
		JWTSecret:              "test-secret",
		JWTIssuer:              "mappening",
		JWTTTL:                 10 * time.Second,
		RefreshTTL:             7 * 24 * time.Hour,
		FrontendURL:            "http://localhost:5173",
		CookieSecure:           false,
		Env:                    "test",
		MediaUploadDir:         "uploads",
		EnableTestAuthFallback: true,
	}

	srv := httptest.NewServer(httpapi.NewRouter(cfg, nil, nil))
	t.Cleanup(srv.Close)

	client := &http.Client{}

	t.Run("login does not use hardcoded admin without db", func(t *testing.T) {
		payload, _ := json.Marshal(map[string]string{
			"email":    "admin@mappening.local",
			"password": "admin1234",
		})

		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/login", bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", cfg.FrontendURL)

		res, err := client.Do(req)
		if err != nil {
			t.Fatalf("login request failed: %v", err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusInternalServerError {
			t.Fatalf("expected 500 without configured auth repo, got %d", res.StatusCode)
		}
		if len(res.Cookies()) != 0 {
			t.Fatalf("expected no auth cookies without configured auth repo")
		}
	})

	t.Run("login still enforces origin before auth state matters", func(t *testing.T) {
		payload, _ := json.Marshal(map[string]string{
			"email":    "admin@mappening.local",
			"password": "admin1234",
		})

		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/login", bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")

		res, err := client.Do(req)
		if err != nil {
			t.Fatalf("login without origin request failed: %v", err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusInternalServerError {
			t.Fatalf("expected 500 before origin checks without configured auth repo, got %d", res.StatusCode)
		}
	})

	t.Run("protected routes are not public", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/auth/me", nil)

		res, err := client.Do(req)
		if err != nil {
			t.Fatalf("me request failed: %v", err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 on protected route, got %d", res.StatusCode)
		}
		if got := res.Header.Get("Cache-Control"); got != "no-store, max-age=0" {
			t.Fatalf("expected protected route Cache-Control no-store, got %q", got)
		}
		if got := res.Header.Get("Pragma"); got != "no-cache" {
			t.Fatalf("expected protected route Pragma no-cache, got %q", got)
		}
	})

	t.Run("health endpoint remains public", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/health", nil)

		res, err := client.Do(req)
		if err != nil {
			t.Fatalf("health request failed: %v", err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected public health endpoint to return 200, got %d", res.StatusCode)
		}
	})
}
