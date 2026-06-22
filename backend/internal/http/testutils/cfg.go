package testutils

import (
	"time"

	"mappening/internal/config"
)

func TestConfig() config.Config {
	return config.Config{
		Addr:                   ":0",
		JWTSecret:              "test-secret",
		JWTIssuer:              "mappening",
		JWTTTL:                 10 * time.Second,
		RefreshTTL:             7 * 24 * time.Hour,
		FrontendURL:            "http://localhost:5173",
		CookieSecure:           false,
		Env:                    "test",
		EnableTestAuthFallback: true,
	}
}
