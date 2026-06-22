package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadLocalDotEnvFiles_LoadsDevLikeDotEnvLocal(t *testing.T) {
	tempDir := t.TempDir()
	writeTempFile(t, filepath.Join(tempDir, ".env.local"), "ENV=dev\nJWT_SECRET=from-dotenv-local\n")

	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	defer func() {
		_ = os.Chdir(oldWD)
	}()

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("chdir: %v", err)
	}

	clearEnv(t, "ENV", "JWT_SECRET")

	if err := LoadLocalDotEnvFiles(); err != nil {
		t.Fatalf("LoadLocalDotEnvFiles: %v", err)
	}

	if got := os.Getenv("JWT_SECRET"); got != "from-dotenv-local" {
		t.Fatalf("expected JWT_SECRET from .env.local, got %q", got)
	}
}

func TestLoadLocalDotEnvFiles_SkipsProdLikeDotEnvLocal(t *testing.T) {
	tempDir := t.TempDir()
	writeTempFile(t, filepath.Join(tempDir, ".env.local"), "ENV=prod\nJWT_SECRET=from-dotenv-local\n")

	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	defer func() {
		_ = os.Chdir(oldWD)
	}()

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("chdir: %v", err)
	}

	clearEnv(t, "ENV", "JWT_SECRET")

	if err := LoadLocalDotEnvFiles(); err != nil {
		t.Fatalf("LoadLocalDotEnvFiles: %v", err)
	}

	if got := os.Getenv("JWT_SECRET"); got != "" {
		t.Fatalf("expected prod-like .env.local to be skipped, got %q", got)
	}
}

func TestLoadLocalDotEnvFiles_IgnoresDotEnvEvenWhenPresent(t *testing.T) {
	tempDir := t.TempDir()
	writeTempFile(t, filepath.Join(tempDir, ".env.local"), "ENV=dev\nJWT_SECRET=from-local\n")
	writeTempFile(t, filepath.Join(tempDir, ".env"), "ENV=prod\nJWT_SECRET=from-prod\n")

	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	defer func() {
		_ = os.Chdir(oldWD)
	}()

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("chdir: %v", err)
	}

	clearEnv(t, "ENV", "JWT_SECRET")

	if err := LoadLocalDotEnvFiles(); err != nil {
		t.Fatalf("LoadLocalDotEnvFiles: %v", err)
	}

	if got := os.Getenv("JWT_SECRET"); got != "from-local" {
		t.Fatalf("expected .env to stay ignored, got %q", got)
	}
}

func writeTempFile(t *testing.T, path, content string) {
	t.Helper()

	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write file %s: %v", path, err)
	}
}
