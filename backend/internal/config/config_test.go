package config

import (
	"os"
	"testing"
	"time"
)

func TestLoad_DefaultValues(t *testing.T) {
	clearEnv(t, "ADDR", "JWT_SECRET", "JWT_ISSUER", "JWT_TTL", "REFRESH_TTL", "COOKIE_SECURE", "CSRF_COOKIE_DOMAIN", "ENV", "FRONTEND_URL", "MAIL_MODE", "MAIL_FROM", "MAIL_FROM_NAME", "SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "MEDIA_UPLOAD_DIR", "PUBLIC_DOCS_ENABLED", "TARPIN_BIEN_USER_AGENT")

	cfg := Load()

	if cfg.Addr != ":8080" {
		t.Fatalf("expected default Addr ':8080', got %q", cfg.Addr)
	}
	if cfg.JWTSecret != "" {
		t.Fatalf("expected empty default JWTSecret, got %q", cfg.JWTSecret)
	}
	if cfg.JWTIssuer != "mappening" {
		t.Fatalf("expected default JWTIssuer 'mappening', got %q", cfg.JWTIssuer)
	}
	if cfg.JWTTTL != 15*time.Minute {
		t.Fatalf("expected default JWTTTL 15m, got %v", cfg.JWTTTL)
	}
	if cfg.RefreshTTL != 168*time.Hour {
		t.Fatalf("expected default RefreshTTL 168h, got %v", cfg.RefreshTTL)
	}
	if !cfg.CookieSecure {
		t.Fatalf("expected default CookieSecure true")
	}
	if cfg.FrontendURL != "" {
		t.Fatalf("expected empty default FrontendURL, got %q", cfg.FrontendURL)
	}
	if cfg.CSRFCookieDomain != "" {
		t.Fatalf("expected empty default CSRFCookieDomain, got %q", cfg.CSRFCookieDomain)
	}
	if cfg.Mail.Mode != "disabled" {
		t.Fatalf("expected production-safe default Mail.Mode disabled, got %q", cfg.Mail.Mode)
	}
	if cfg.MediaUploadDir != "/var/lib/mappening/uploads" {
		t.Fatalf("expected production-safe upload dir, got %q", cfg.MediaUploadDir)
	}
	if cfg.PublicDocsEnabled {
		t.Fatalf("expected public docs to be disabled by default")
	}
	if cfg.TarpinBienUserAgent != "MappeningBot/1.0 (+https://mappening.fr)" {
		t.Fatalf("expected production user agent, got %q", cfg.TarpinBienUserAgent)
	}
}

func TestLoad_DevDefaultsRemainConvenientWhenEnvIsExplicitlyDev(t *testing.T) {
	setEnv(t, "ENV", "dev")
	clearEnv(t, "ADDR", "COOKIE_SECURE", "FRONTEND_URL", "APP_DB_SSLMODE", "MIGRATIONS_DB_SSLMODE", "MAIL_MODE", "MEDIA_UPLOAD_DIR", "PUBLIC_DOCS_ENABLED")

	cfg := Load()

	if cfg.Addr != "127.0.0.1:8080" {
		t.Fatalf("expected dev Addr loopback, got %q", cfg.Addr)
	}
	if cfg.CookieSecure {
		t.Fatalf("expected dev CookieSecure false")
	}
	if cfg.FrontendURL != "http://localhost:5173" {
		t.Fatalf("expected dev FrontendURL localhost, got %q", cfg.FrontendURL)
	}
	if cfg.AppDB.SSLMode != "disable" || cfg.MigrationsDB.SSLMode != "disable" {
		t.Fatalf("expected dev DB SSL modes disabled")
	}
	if cfg.Mail.Mode != "log" {
		t.Fatalf("expected dev Mail.Mode log, got %q", cfg.Mail.Mode)
	}
	if cfg.MediaUploadDir != "uploads" {
		t.Fatalf("expected dev upload dir, got %q", cfg.MediaUploadDir)
	}
	if !cfg.PublicDocsEnabled {
		t.Fatalf("expected public docs to be enabled in dev")
	}
}

func TestLoad_WithEnvOverrides(t *testing.T) {
	setEnv(t, "ADDR", ":9999")
	setEnv(t, "JWT_SECRET", "super-secret")
	setEnv(t, "JWT_ISSUER", "custom-issuer")
	setEnv(t, "JWT_TTL", "30m")
	setEnv(t, "REFRESH_TTL", "24h")
	setEnv(t, "COOKIE_SECURE", "true")
	setEnv(t, "CSRF_COOKIE_DOMAIN", ".example.com")
	setEnv(t, "ENV", "prod")
	setEnv(t, "FRONTEND_URL", "https://example.com")
	setEnv(t, "MEDIA_UPLOAD_DIR", "/srv/mappening/uploads")
	setEnv(t, "PUBLIC_DOCS_ENABLED", "true")
	setEnv(t, "TARPIN_BIEN_USER_AGENT", "MappeningBot/2.0 (+https://mappening.fr)")

	cfg := Load()

	if cfg.Addr != ":9999" || cfg.JWTSecret != "super-secret" || cfg.JWTIssuer != "custom-issuer" {
		t.Fatalf("env overrides were not applied: %+v", cfg)
	}
	if cfg.JWTTTL != 30*time.Minute || cfg.RefreshTTL != 24*time.Hour {
		t.Fatalf("duration overrides were not applied")
	}
	if cfg.FrontendURL != "https://example.com" {
		t.Fatalf("expected overridden FrontendURL, got %q", cfg.FrontendURL)
	}
	if cfg.CSRFCookieDomain != "example.com" {
		t.Fatalf("expected overridden CSRFCookieDomain, got %q", cfg.CSRFCookieDomain)
	}
	if cfg.MediaUploadDir != "/srv/mappening/uploads" {
		t.Fatalf("expected overridden MediaUploadDir, got %q", cfg.MediaUploadDir)
	}
	if !cfg.PublicDocsEnabled {
		t.Fatalf("expected overridden PublicDocsEnabled")
	}
	if cfg.TarpinBienUserAgent != "MappeningBot/2.0 (+https://mappening.fr)" {
		t.Fatalf("expected overridden TarpinBienUserAgent, got %q", cfg.TarpinBienUserAgent)
	}
}

func TestValidateAPI_RejectsMissingEnvByDefault(t *testing.T) {
	cfg := validDevConfig()
	cfg.Env = ""

	if err := cfg.ValidateAPI(); err == nil {
		t.Fatalf("expected ValidateAPI to fail when ENV is not explicitly set")
	}
}

func TestValidateAPI_RejectsTestEnvOutsideAutomatedTests(t *testing.T) {
	cfg := validDevConfig()
	cfg.Env = "test"
	cfg.EnableTestAuthFallback = false

	if err := cfg.ValidateAPI(); err == nil {
		t.Fatalf("expected ValidateAPI to reject ENV=test outside automated tests")
	}
}

func TestValidateAPI_ProductionRequiresSecureSettings(t *testing.T) {
	cfg := validProdConfig()
	cfg.CookieSecure = false

	if err := cfg.ValidateAPI(); err == nil {
		t.Fatalf("expected ValidateAPI to reject insecure production settings")
	}
}

func TestValidateAPI_ProductionAllowsLocalPostgresWithoutTLS(t *testing.T) {
	cfg := validProdConfig()
	cfg.AppDB.Host = "127.0.0.1"
	cfg.AppDB.SSLMode = "disable"

	if err := cfg.ValidateAPI(); err != nil {
		t.Fatalf("expected local PostgreSQL to be accepted without TLS, got %v", err)
	}
}

func TestValidateAPI_ProductionRejectsRemotePostgresWithoutTLS(t *testing.T) {
	cfg := validProdConfig()
	cfg.AppDB.Host = "db.example.com"
	cfg.AppDB.SSLMode = "disable"

	if err := cfg.ValidateAPI(); err == nil {
		t.Fatalf("expected remote PostgreSQL without TLS to be rejected")
	}
}

func TestValidateMigrations_ProductionAllowsLocalPostgresWithoutTLS(t *testing.T) {
	cfg := validProdConfig()
	cfg.MigrationsDB.Host = "127.0.0.1"
	cfg.MigrationsDB.Password = "super-secure-migration-password"
	cfg.MigrationsDB.SSLMode = "disable"

	if err := cfg.ValidateMigrations(); err != nil {
		t.Fatalf("expected local migrations PostgreSQL to be accepted without TLS, got %v", err)
	}
}

func TestValidateMigrations_ProductionRejectsRemotePostgresWithoutTLS(t *testing.T) {
	cfg := validProdConfig()
	cfg.MigrationsDB.Host = "db.example.com"
	cfg.MigrationsDB.Password = "super-secure-migration-password"
	cfg.MigrationsDB.SSLMode = "disable"

	if err := cfg.ValidateMigrations(); err == nil {
		t.Fatalf("expected remote migrations PostgreSQL without TLS to be rejected")
	}
}

func TestValidateJobs_ProductionRejectsRemotePostgresWithoutTLS(t *testing.T) {
	cfg := validProdConfig()
	cfg.AppDB.Host = "db.example.com"
	cfg.AppDB.SSLMode = "disable"

	if err := cfg.ValidateJobs(); err == nil {
		t.Fatalf("expected remote jobs PostgreSQL without TLS to be rejected")
	}
}

func TestValidateAPI_DevLoginRequiresLoopbackFrontendAndNoTrustedProxy(t *testing.T) {
	cfg := validDevConfig()
	cfg.FrontendURL = "https://example.com"
	cfg.DevLoginEnabled = true
	cfg.DevLoginEmail = "admin@mappening.local"
	cfg.TrustedProxyCIDRs = []string{"127.0.0.1"}

	if err := cfg.ValidateAPI(); err == nil {
		t.Fatalf("expected ValidateAPI to reject unsafe dev login settings")
	}
}

func TestValidateAPI_DevelopmentRequiresLoopbackFrontendAndAddr(t *testing.T) {
	cfg := validDevConfig()
	cfg.Addr = ":8080"

	if err := cfg.ValidateAPI(); err == nil {
		t.Fatalf("expected ValidateAPI to reject a non-loopback development bind address")
	}
}

func TestValidateAPI_RejectsInvalidTrustedProxyCIDR(t *testing.T) {
	cfg := validProdConfig()
	cfg.TrustedProxyCIDRs = []string{"not-a-cidr"}

	if err := cfg.ValidateAPI(); err == nil {
		t.Fatalf("expected ValidateAPI to reject invalid trusted proxy entries")
	}
}

func TestValidateAPI_RejectsFrontendURLWithPathOrCredentials(t *testing.T) {
	cfg := validProdConfig()
	cfg.FrontendURL = "https://user:pass@example.com/app"

	if err := cfg.ValidateAPI(); err == nil {
		t.Fatalf("expected ValidateAPI to reject a frontend URL with credentials or a path")
	}
}

func TestValidateAPI_RejectsCSRFCookieDomainOutsideFrontendHost(t *testing.T) {
	cfg := validProdConfig()
	cfg.FrontendURL = "https://app.example.com"
	cfg.CSRFCookieDomain = "attacker.example"

	if err := cfg.ValidateAPI(); err == nil {
		t.Fatalf("expected ValidateAPI to reject unrelated CSRF cookie domain")
	}
}

func TestValidateAPI_AllowsCSRFCookieParentDomain(t *testing.T) {
	cfg := validProdConfig()
	cfg.FrontendURL = "https://app.example.com"
	cfg.CSRFCookieDomain = ".example.com"

	if err := cfg.ValidateAPI(); err != nil {
		t.Fatalf("expected parent CSRF cookie domain to be accepted, got %v", err)
	}
}

func TestValidateAPI_AllowsTrustedProxyIPsAndCIDRs(t *testing.T) {
	cfg := validProdConfig()
	cfg.TrustedProxyCIDRs = []string{"127.0.0.1", "10.0.0.0/8"}

	if err := cfg.ValidateAPI(); err != nil {
		t.Fatalf("expected trusted proxy entries to be accepted, got %v", err)
	}
}

func validDevConfig() Config {
	cfg := Load()
	cfg.Env = "dev"
	cfg.Addr = "127.0.0.1:8080"
	cfg.CookieSecure = false
	cfg.FrontendURL = "http://localhost:5173"
	cfg.JWTSecret = "dev-secret"
	cfg.AppDB.Password = "password"
	cfg.AppDB.SSLMode = "disable"
	cfg.Mail.Mode = "log"
	return cfg
}

func validProdConfig() Config {
	cfg := Load()
	cfg.Env = "prod"
	cfg.CookieSecure = true
	cfg.FrontendURL = "https://example.com"
	cfg.JWTSecret = "01234567890123456789012345678901"
	cfg.AppDB.Password = "super-secure-password"
	cfg.AppDB.SSLMode = "require"
	cfg.MigrationsDB.Password = "super-secure-migration-password"
	cfg.MigrationsDB.SSLMode = "require"
	cfg.Mail.Mode = "disabled"
	return cfg
}

func setEnv(t *testing.T, key, value string) {
	t.Helper()
	old, exists := os.LookupEnv(key)
	if err := os.Setenv(key, value); err != nil {
		t.Fatalf("failed to set env %s: %v", key, err)
	}
	t.Cleanup(func() {
		if exists {
			_ = os.Setenv(key, old)
		} else {
			_ = os.Unsetenv(key)
		}
	})
}

func clearEnv(t *testing.T, keys ...string) {
	t.Helper()
	for _, key := range keys {
		old, exists := os.LookupEnv(key)
		_ = os.Unsetenv(key)
		t.Cleanup(func() {
			if exists {
				_ = os.Setenv(key, old)
			}
		})
	}
}
