package db

import (
	"net/url"
	"testing"
	"time"

	"mappening/internal/config"
)

func TestPostgresDSN_EncodesConnectionSettings(t *testing.T) {
	dsn := postgresDSN(config.DBConfig{
		Host:        "db.internal",
		Port:        "5432",
		Name:        "mappening_test",
		User:        "app user",
		Password:    "p@ss word/with/slashes",
		SSLMode:     "verify-full",
		MaxConns:    7,
		MaxIdle:     3,
		MaxLifetime: time.Minute,
	})

	parsed, err := url.Parse(dsn)
	if err != nil {
		t.Fatalf("parse dsn: %v", err)
	}

	if parsed.Scheme != "postgres" {
		t.Fatalf("expected postgres scheme, got %q", parsed.Scheme)
	}
	if parsed.Hostname() != "db.internal" {
		t.Fatalf("expected host db.internal, got %q", parsed.Hostname())
	}
	if parsed.Port() != "5432" {
		t.Fatalf("expected port 5432, got %q", parsed.Port())
	}
	if parsed.Path != "/mappening_test" {
		t.Fatalf("expected database path /mappening_test, got %q", parsed.Path)
	}
	if parsed.User.Username() != "app user" {
		t.Fatalf("expected encoded username to round-trip")
	}
	password, ok := parsed.User.Password()
	if !ok || password != "p@ss word/with/slashes" {
		t.Fatalf("expected encoded password to round-trip")
	}
	if got := parsed.Query().Get("sslmode"); got != "verify-full" {
		t.Fatalf("expected sslmode verify-full, got %q", got)
	}
	if got := parsed.Query().Get("application_name"); got != "mappening" {
		t.Fatalf("expected application_name mappening, got %q", got)
	}
}
