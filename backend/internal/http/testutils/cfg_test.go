package testutils

import (
	"testing"
	"time"
)

func TestTestConfig_IsValidForTestRouter(t *testing.T) {
	cfg := TestConfig()

	if cfg.Env != "test" {
		t.Fatalf("expected test env, got %q", cfg.Env)
	}
	if !cfg.EnableTestAuthFallback {
		t.Fatalf("expected test auth fallback to be enabled")
	}
	if cfg.JWTSecret == "" || cfg.JWTIssuer == "" {
		t.Fatalf("expected JWT settings to be populated")
	}
	if cfg.JWTTTL <= 0 || cfg.RefreshTTL <= time.Hour {
		t.Fatalf("expected positive token TTLs")
	}
	if cfg.FrontendURL != "http://localhost:5173" {
		t.Fatalf("expected frontend URL for local test CORS, got %q", cfg.FrontendURL)
	}
}
