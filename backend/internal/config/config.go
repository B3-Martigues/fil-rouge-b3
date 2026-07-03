package config

import (
	"fmt"
	"net"
	mailpkg "net/mail"
	"net/netip"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type DBConfig struct {
	Host        string
	Port        string
	Name        string
	User        string
	Password    string
	SSLMode     string
	MaxConns    int
	MaxIdle     int
	MaxLifetime time.Duration
}

type MailConfig struct {
	Mode     string
	From     string
	FromName string
	SMTP     SMTPConfig
}

type SMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
}

type Config struct {
	Addr                     string
	JWTSecret                string
	JWTIssuer                string
	JWTTTL                   time.Duration
	RefreshTTL               time.Duration
	FrontendURL              string
	CookieSecure             bool
	CSRFCookieDomain         string
	Env                      string
	DevLoginEnabled          bool
	DevLoginEmail            string
	TrustedProxyCIDRs        []string
	TarpinBienScraperEnabled bool

	EnableTestAuthFallback bool

	AppDB        DBConfig
	MigrationsDB DBConfig
	Mail         MailConfig
}

// Charge la configuration runtime depuis l'environnement avec des valeurs par defaut adaptees au dev local.
func Load() Config {
	env := normalizeEnv(getEnv("ENV", ""))
	devLikeEnv := isDevLikeEnv(env)

	addrDefault := ":8080"
	frontendURLDefault := ""
	cookieSecureDefault := true
	appDBSSLModeDefault := "require"
	migrationsDBSSLModeDefault := "require"
	mailModeDefault := "disabled"

	if devLikeEnv {
		addrDefault = "127.0.0.1:8080"
		frontendURLDefault = "http://localhost:5173"
		cookieSecureDefault = false
		appDBSSLModeDefault = "disable"
		migrationsDBSSLModeDefault = "disable"
		mailModeDefault = "log"
	}

	return Config{
		Addr:                     getEnv("ADDR", addrDefault),
		JWTSecret:                getEnv("JWT_SECRET", ""),
		JWTIssuer:                getEnv("JWT_ISSUER", "mappening"),
		JWTTTL:                   getDuration("JWT_TTL", 15*time.Minute),
		RefreshTTL:               getDuration("REFRESH_TTL", 168*time.Hour),
		FrontendURL:              getEnv("FRONTEND_URL", frontendURLDefault),
		CookieSecure:             getBool("COOKIE_SECURE", cookieSecureDefault),
		CSRFCookieDomain:         normalizeCookieDomain(getEnv("CSRF_COOKIE_DOMAIN", "")),
		Env:                      env,
		DevLoginEnabled:          getBool("DEV_LOGIN_ENABLED", false),
		DevLoginEmail:            strings.TrimSpace(strings.ToLower(getEnv("DEV_LOGIN_EMAIL", ""))),
		TrustedProxyCIDRs:        getCSV("TRUSTED_PROXY_CIDRS"),
		TarpinBienScraperEnabled: getBool("TARPIN_BIEN_SCRAPER_ENABLED", true),

		AppDB: DBConfig{
			Host:        getEnv("APP_DB_HOST", "127.0.0.1"),
			Port:        getEnv("APP_DB_PORT", "5432"),
			Name:        getEnv("APP_DB_NAME", "mappening"),
			User:        getEnv("APP_DB_USER", "mappening_user"),
			Password:    getEnv("APP_DB_PASSWORD", ""),
			SSLMode:     getEnv("APP_DB_SSLMODE", appDBSSLModeDefault),
			MaxConns:    getInt("APP_DB_MAX_CONNS", 20),
			MaxIdle:     getInt("APP_DB_MAX_IDLE", 10),
			MaxLifetime: getDuration("APP_DB_MAX_LIFETIME", time.Hour),
		},

		MigrationsDB: DBConfig{
			Host:        getEnv("MIGRATIONS_DB_HOST", "127.0.0.1"),
			Port:        getEnv("MIGRATIONS_DB_PORT", "5432"),
			Name:        getEnv("MIGRATIONS_DB_NAME", "mappening"),
			User:        getEnv("MIGRATIONS_DB_USER", "mappening_migrator"),
			Password:    getEnv("MIGRATIONS_DB_PASSWORD", ""),
			SSLMode:     getEnv("MIGRATIONS_DB_SSLMODE", migrationsDBSSLModeDefault),
			MaxConns:    getInt("MIGRATIONS_DB_MAX_CONNS", 5),
			MaxIdle:     getInt("MIGRATIONS_DB_MAX_IDLE", 2),
			MaxLifetime: getDuration("MIGRATIONS_DB_MAX_LIFETIME", 30*time.Minute),
		},

		Mail: MailConfig{
			Mode:     strings.ToLower(strings.TrimSpace(getEnv("MAIL_MODE", mailModeDefault))),
			From:     strings.TrimSpace(getEnv("MAIL_FROM", "no-reply@mappening.local")),
			FromName: strings.TrimSpace(getEnv("MAIL_FROM_NAME", "Mappening")),
			SMTP: SMTPConfig{
				Host:     strings.TrimSpace(getEnv("SMTP_HOST", "")),
				Port:     strings.TrimSpace(getEnv("SMTP_PORT", "587")),
				Username: strings.TrimSpace(getEnv("SMTP_USERNAME", "")),
				Password: getEnv("SMTP_PASSWORD", ""),
			},
		},
	}
}

// Valide la configuration necessaire au lancement de l'API.
func (c Config) ValidateAPI() error {
	normalizedEnv := normalizeEnv(c.Env)
	if normalizedEnv == "" {
		return fmt.Errorf("ENV is required")
	}
	if normalizedEnv == "test" && !c.EnableTestAuthFallback {
		return fmt.Errorf("ENV=test is reserved for automated tests")
	}

	if c.Addr == "" {
		return fmt.Errorf("ADDR is required")
	}

	if strings.TrimSpace(c.JWTSecret) == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}

	if c.JWTIssuer == "" {
		return fmt.Errorf("JWT_ISSUER is required")
	}

	if c.JWTTTL <= 0 {
		return fmt.Errorf("JWT_TTL must be greater than 0")
	}

	if c.RefreshTTL <= 0 {
		return fmt.Errorf("REFRESH_TTL must be greater than 0")
	}

	if c.FrontendURL == "" {
		return fmt.Errorf("FRONTEND_URL is required")
	}

	if err := validateFrontendURL(c.FrontendURL, c.Env); err != nil {
		return err
	}
	if err := validateCSRFCookieDomain(c.CSRFCookieDomain, c.FrontendURL, c.Env); err != nil {
		return err
	}
	if isRuntimeDevEnv(c.Env) {
		if err := validateLoopbackFrontendURL(c.FrontendURL); err != nil {
			return err
		}
		if err := validateLoopbackListenAddr(c.Addr); err != nil {
			return err
		}
	}

	if err := validateTrustedProxyCIDRs(c.TrustedProxyCIDRs); err != nil {
		return err
	}

	if err := validateDBConfig("APP_DB", c.AppDB); err != nil {
		return err
	}
	if err := validateMailConfig(c.Mail); err != nil {
		return err
	}

	if c.DevLoginEnabled {
		if !isRuntimeDevEnv(c.Env) {
			return fmt.Errorf("DEV_LOGIN_ENABLED is only allowed in development")
		}

		if c.DevLoginEmail == "" {
			return fmt.Errorf("DEV_LOGIN_EMAIL is required when DEV_LOGIN_ENABLED=true")
		}

		if err := validateLoopbackFrontendURL(c.FrontendURL); err != nil {
			return err
		}

		if len(c.TrustedProxyCIDRs) > 0 {
			return fmt.Errorf("DEV_LOGIN_ENABLED cannot be used when TRUSTED_PROXY_CIDRS is configured")
		}
	}

	if !isDevLikeEnv(c.Env) {
		if c.JWTSecret == "" || c.JWTSecret == "change-me" {
			return fmt.Errorf("JWT_SECRET is not secure outside development")
		}

		if len(c.JWTSecret) < 32 {
			return fmt.Errorf("JWT_SECRET must be at least 32 characters outside development")
		}

		if c.AppDB.Password == "" || c.AppDB.Password == "change-me" {
			return fmt.Errorf("APP_DB_PASSWORD is required outside development")
		}

		if !c.CookieSecure {
			return fmt.Errorf("COOKIE_SECURE must be true outside development")
		}

		if c.AppDB.SSLMode == "disable" {
			return fmt.Errorf("APP_DB_SSLMODE must not be disable outside development")
		}

		if !strings.HasPrefix(c.FrontendURL, "https://") {
			return fmt.Errorf("FRONTEND_URL must use https outside development")
		}
	}

	return nil
}

func validateMailConfig(mail MailConfig) error {
	switch strings.ToLower(strings.TrimSpace(mail.Mode)) {
	case "disabled", "log":
		return nil
	case "smtp":
		if strings.TrimSpace(mail.From) == "" {
			return fmt.Errorf("MAIL_FROM is required when MAIL_MODE=smtp")
		}
		if parsed, err := mailpkg.ParseAddress(mail.From); err != nil || parsed.Address != mail.From {
			return fmt.Errorf("MAIL_FROM must be a valid email address")
		}
		if strings.TrimSpace(mail.SMTP.Host) == "" {
			return fmt.Errorf("SMTP_HOST is required when MAIL_MODE=smtp")
		}
		if strings.TrimSpace(mail.SMTP.Port) == "" {
			return fmt.Errorf("SMTP_PORT is required when MAIL_MODE=smtp")
		}
		if _, err := strconv.Atoi(mail.SMTP.Port); err != nil {
			return fmt.Errorf("SMTP_PORT must be numeric")
		}
		return nil
	default:
		return fmt.Errorf("MAIL_MODE must be disabled, log or smtp")
	}
}

// Valide la configuration minimale requise pour les migrations SQL.
func (c Config) ValidateMigrations() error {
	if err := validateDBConfig("MIGRATIONS_DB", c.MigrationsDB); err != nil {
		return err
	}

	if !isDevLikeEnv(c.Env) {
		if c.MigrationsDB.Password == "" || c.MigrationsDB.Password == "change-me" {
			return fmt.Errorf("MIGRATIONS_DB_PASSWORD is required outside development")
		}

		if c.MigrationsDB.SSLMode == "disable" {
			return fmt.Errorf("MIGRATIONS_DB_SSLMODE must not be disable outside development")
		}
	}

	return nil
}

// Valide la configuration minimale requise pour les jobs applicatifs hors HTTP.
func (c Config) ValidateJobs() error {
	return validateDBConfig("APP_DB", c.AppDB)
}

// Expose la normalisation d'environnement aux autres packages.
func NormalizeEnv(value string) string {
	return normalizeEnv(value)
}

// Indique si un environnement doit etre traite comme local/developpement.
func IsDevLikeEnv(value string) bool {
	return isDevLikeEnv(value)
}

// Expose le test de loopback pour les validations inter-packages.
func IsLoopbackHost(value string) bool {
	return isLoopbackHost(value)
}

// Verifie qu'une configuration base de donnees est complete et coherente.
func validateDBConfig(prefix string, db DBConfig) error {
	if db.Host == "" {
		return fmt.Errorf("%s_HOST is required", prefix)
	}

	if db.Port == "" {
		return fmt.Errorf("%s_PORT is required", prefix)
	}

	if db.Name == "" {
		return fmt.Errorf("%s_NAME is required", prefix)
	}

	if db.User == "" {
		return fmt.Errorf("%s_USER is required", prefix)
	}

	if db.MaxConns <= 0 {
		return fmt.Errorf("%s_MAX_CONNS must be greater than 0", prefix)
	}

	if db.MaxIdle < 0 {
		return fmt.Errorf("%s_MAX_IDLE must be greater than or equal to 0", prefix)
	}

	if db.MaxIdle > db.MaxConns {
		return fmt.Errorf("%s_MAX_IDLE cannot be greater than %s_MAX_CONNS", prefix, prefix)
	}

	if db.MaxLifetime <= 0 {
		return fmt.Errorf("%s_MAX_LIFETIME must be greater than 0", prefix)
	}

	switch db.SSLMode {
	case "disable", "require", "verify-ca", "verify-full":
	default:
		return fmt.Errorf("%s_SSLMODE is invalid: %s", prefix, db.SSLMode)
	}

	return nil
}

// Lit une variable d'environnement texte avec valeur par defaut.
func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// Parse une variable CSV en liste nettoyee.
func getCSV(key string) []string {
	v := os.Getenv(key)
	if v == "" {
		return nil
	}

	values := make([]string, 0)
	for _, part := range strings.Split(v, ",") {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			values = append(values, trimmed)
		}
	}

	return values
}

// Parse un booleen d'environnement avec repli sur une valeur par defaut.
func getBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}

	parsed, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}

	return parsed
}

// Parse un entier d'environnement.
func getInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}

	parsed, err := strconv.Atoi(v)
	if err != nil {
		return def
	}

	return parsed
}

// Parse une duree Go depuis l'environnement.
func getDuration(key string, def time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return def
	}

	parsed, err := time.ParseDuration(v)
	if err != nil {
		return def
	}

	return parsed
}

// Normalise un nom d'environnement pour les comparaisons internes.
func normalizeEnv(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

// Regroupe les environnements qui beneficient des assouplissements de developpement.
func isDevLikeEnv(value string) bool {
	switch normalizeEnv(value) {
	case "dev", "development", "test", "local":
		return true
	default:
		return false
	}
}

// Reserve certains comportements aux environnements d'execution vraiment locaux.
func isRuntimeDevEnv(value string) bool {
	switch normalizeEnv(value) {
	case "dev", "development", "local":
		return true
	default:
		return false
	}
}

// Verifie que FRONTEND_URL represente bien une origine propre et exploitable.
func validateFrontendURL(rawURL string, env string) error {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || !parsed.IsAbs() {
		return fmt.Errorf("FRONTEND_URL must be an absolute URL")
	}
	if parsed.User != nil {
		return fmt.Errorf("FRONTEND_URL must not include credentials")
	}
	if parsed.Hostname() == "" {
		return fmt.Errorf("FRONTEND_URL host is required")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return fmt.Errorf("FRONTEND_URL must not include query parameters or fragments")
	}
	if parsed.Path != "" && parsed.Path != "/" {
		return fmt.Errorf("FRONTEND_URL must be an origin without a path")
	}

	if !isDevLikeEnv(env) && isLoopbackHost(parsed.Hostname()) {
		return fmt.Errorf("FRONTEND_URL must not point to a loopback host outside development")
	}

	return nil
}

// Verifie qu'un domaine optionnel de cookie CSRF ne peut pas elargir le cookie
// vers un domaine sans rapport avec le client autorise.
func validateCSRFCookieDomain(rawDomain string, frontendURL string, env string) error {
	domain := normalizeCookieDomain(rawDomain)
	if domain == "" {
		return nil
	}

	if strings.ContainsAny(domain, "/:\\@") || strings.Contains(domain, "*") {
		return fmt.Errorf("CSRF_COOKIE_DOMAIN must be a domain name, without scheme, port or path")
	}
	if isLoopbackHost(domain) {
		return fmt.Errorf("CSRF_COOKIE_DOMAIN must not be a loopback host")
	}

	parsedFrontend, err := url.Parse(strings.TrimSpace(frontendURL))
	if err != nil || parsedFrontend.Hostname() == "" {
		return fmt.Errorf("CSRF_COOKIE_DOMAIN requires a valid FRONTEND_URL")
	}

	frontendHost := strings.ToLower(strings.Trim(parsedFrontend.Hostname(), "."))
	if frontendHost != domain && !strings.HasSuffix(frontendHost, "."+domain) {
		return fmt.Errorf("CSRF_COOKIE_DOMAIN must match FRONTEND_URL host or one of its parent domains")
	}

	if !isDevLikeEnv(env) && !strings.Contains(domain, ".") {
		return fmt.Errorf("CSRF_COOKIE_DOMAIN must be a fully qualified domain outside development")
	}

	return nil
}

// Normalise la notation acceptee par les navigateurs pour l'attribut Domain.
func normalizeCookieDomain(rawDomain string) string {
	return strings.ToLower(strings.Trim(strings.TrimSpace(rawDomain), "."))
}

// Detecte si un host correspond a une interface loopback.
func isLoopbackHost(host string) bool {
	normalized := strings.TrimSpace(strings.Trim(host, "[]"))
	if strings.EqualFold(normalized, "localhost") {
		return true
	}

	ip := net.ParseIP(normalized)
	return ip != nil && ip.IsLoopback()
}

// Exige un client local quand la connexion de dev rapide est activee.
func validateLoopbackFrontendURL(rawURL string) error {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || !parsed.IsAbs() {
		return fmt.Errorf("FRONTEND_URL must be an absolute URL when DEV_LOGIN_ENABLED=true")
	}
	if !isLoopbackHost(parsed.Hostname()) {
		return fmt.Errorf("FRONTEND_URL must point to a loopback host when DEV_LOGIN_ENABLED=true")
	}

	return nil
}

// Exige une ecoute locale explicite en developpement pour eviter les expos involontaires.
func validateLoopbackListenAddr(rawAddr string) error {
	trimmed := strings.TrimSpace(rawAddr)
	if trimmed == "" {
		return fmt.Errorf("ADDR is required")
	}

	host, _, err := net.SplitHostPort(trimmed)
	if err != nil {
		return fmt.Errorf("ADDR must be in host:port form when ENV is development")
	}
	if !isLoopbackHost(host) {
		return fmt.Errorf("ADDR must bind to a loopback host when ENV is development")
	}

	return nil
}

// Verifie la validite syntaxique de toutes les plages de proxies de confiance.
func validateTrustedProxyCIDRs(entries []string) error {
	for _, entry := range entries {
		if _, err := parseTrustedProxyCIDR(entry); err != nil {
			return fmt.Errorf("TRUSTED_PROXY_CIDRS contains invalid entry %q: %w", entry, err)
		}
	}

	return nil
}

// Parse une entree proxy de confiance au format CIDR ou IP simple.
func parseTrustedProxyCIDR(value string) (netip.Prefix, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return netip.Prefix{}, fmt.Errorf("empty trusted proxy entry")
	}

	if strings.Contains(trimmed, "/") {
		prefix, err := netip.ParsePrefix(trimmed)
		if err != nil {
			return netip.Prefix{}, err
		}

		return prefix.Masked(), nil
	}

	addr, err := netip.ParseAddr(trimmed)
	if err != nil {
		return netip.Prefix{}, err
	}

	return netip.PrefixFrom(addr, addr.BitLen()), nil
}
