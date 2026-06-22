package http

import (
	"context"
	"database/sql"
	nethttp "net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rs/zerolog/log"

	"mappening/internal/auth"
	"mappening/internal/config"
	"mappening/internal/http/middleware"
	"mappening/internal/users"
)

// NewRouter construit le routeur backend minimal: auth, users admin et health.
func NewRouter(cfg config.Config, db *sql.DB) nethttp.Handler {
	var store auth.RefreshTokenStore = auth.NewRefreshStore()

	var authUserRepo authUserReader
	var userRepo *users.Repository

	if db != nil {
		dbStore, err := auth.NewDBRefreshStore(db)
		if err != nil {
			log.Error().Err(err).Msg("failed to initialize database refresh store")
		} else {
			store = dbStore
		}

		userRepo = users.NewRepository(db)
		authUserRepo = userRepo
	} else if cfg.EnableTestAuthFallback && config.NormalizeEnv(cfg.Env) == "test" {
		authUserRepo = staticAuthUserRepo{}
	}

	adminUsersHandler := users.AdminHandler{
		UserRepo:     userRepo,
		SessionStore: store,
	}

	return newRouter(cfg, db, store, authUserRepo, adminUsersHandler)
}

type authUserReader interface {
	GetByEmail(ctx context.Context, email string) (*users.User, error)
}

func newRouter(
	cfg config.Config,
	db *sql.DB,
	store auth.RefreshTokenStore,
	authUserRepo authUserReader,
	adminUsers users.AdminHandler,
) nethttp.Handler {
	r := chi.NewRouter()

	loginRateLimiter := middleware.NewDBRateLimiter(db, 30, time.Minute, cfg.TrustedProxyCIDRs...)
	loginAccountRateLimiter := middleware.NewDBRateLimiterWithKeyBuilder(
		db,
		5,
		15*time.Minute,
		middleware.LoginEmailRateLimitKey(8<<10),
	)
	loginGlobalAccountRateLimiter := middleware.NewDBRateLimiterWithKeyBuilder(
		db,
		20,
		15*time.Minute,
		middleware.LoginEmailOnlyRateLimitKey(8<<10),
	)
	refreshRateLimiter := middleware.NewDBRateLimiter(db, 30, time.Minute, cfg.TrustedProxyCIDRs...)
	adminWriteRateLimiter := middleware.NewDBRateLimiter(db, 60, time.Minute, cfg.TrustedProxyCIDRs...)

	r.Use(middleware.RequestID())
	r.Use(middleware.AccessLog(cfg.TrustedProxyCIDRs...))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.FrontendURL},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"X-CSRF-Token", middleware.RequestIDHeader},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(middleware.SecurityHeaders(cfg.TrustedProxyCIDRs...))
	r.Use(chimiddleware.Recoverer)

	r.Use(middleware.CsrfProtect(middleware.CsrfOptions{
		CookieName: "csrf_token",
		HeaderName: "X-CSRF-Token",
		SkipPaths: []string{
			"/api/auth/login",
			"/api/auth/login/dev",
			"/api/auth/register/user",
			"/api/auth/register/organization",
		},
		FrontendURL: cfg.FrontendURL,
	}))

	authHandler := auth.Handler{
		Secret:           cfg.JWTSecret,
		Issuer:           cfg.JWTIssuer,
		AccessTTL:        cfg.JWTTTL,
		RefreshTTL:       cfg.RefreshTTL,
		CookieSecure:     cfg.CookieSecure,
		CSRFCookieDomain: cfg.CSRFCookieDomain,
		Env:              cfg.Env,
		FrontendURL:      cfg.FrontendURL,
		DevLoginEnabled:  cfg.DevLoginEnabled,
		DevLoginEmail:    cfg.DevLoginEmail,
		Store:            store,
		UserRepo:         authUserRepo,
	}

	r.Get("/api/health", func(w nethttp.ResponseWriter, r *nethttp.Request) {
		w.WriteHeader(nethttp.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.With(
		middleware.NoStore(),
		loginRateLimiter.Handler(),
		loginAccountRateLimiter.Handler(),
		loginGlobalAccountRateLimiter.Handler(),
	).Post("/api/auth/login", authHandler.Login)
	r.With(middleware.NoStore(), loginRateLimiter.Handler()).Post("/api/auth/login/dev", authHandler.DevLogin)
	r.With(middleware.NoStore(), loginRateLimiter.Handler()).Post("/api/auth/register/user", authHandler.RegisterUser)
	r.With(middleware.NoStore(), loginRateLimiter.Handler()).Post("/api/auth/register/organization", authHandler.RegisterOrganization)
	r.With(middleware.NoStore(), refreshRateLimiter.Handler()).Post("/api/auth/refresh", authHandler.Refresh)

	r.Group(func(pr chi.Router) {
		pr.Use(middleware.NoStore())
		pr.Use(middleware.AuthJWTWithUserLookup(cfg.JWTSecret, cfg.JWTIssuer, cfg.Env, authUserRepo))

		pr.Post("/api/auth/logout", authHandler.Logout)
		pr.Get("/api/auth/me", authHandler.Me)
		pr.Patch("/api/auth/password", authHandler.ChangePassword)
		pr.Get("/api/auth/check-role/{role}", authHandler.CheckRole)
		pr.Get("/api/auth/check-account-type/{accountType}", authHandler.CheckAccountType)
		pr.Patch("/api/auth/deactivate", authHandler.DeactivateAccount)
		pr.Delete("/api/auth/account", authHandler.DeleteAccount)

		pr.Group(func(ar chi.Router) {
			ar.Use(middleware.RequireRole("admin"))

			ar.Get("/api/admin/users", adminUsers.List)
			ar.With(adminWriteRateLimiter.Handler()).Post("/api/admin/users", adminUsers.Create)
			ar.With(adminWriteRateLimiter.Handler()).Patch("/api/admin/users/{userID}", adminUsers.Update)
			ar.With(adminWriteRateLimiter.Handler()).Delete("/api/admin/users/{userID}", adminUsers.Delete)
			ar.With(adminWriteRateLimiter.Handler()).Post("/api/admin/users/{userID}/reset-password", adminUsers.ResetPassword)
			ar.Get("/api/health/db", func(w nethttp.ResponseWriter, r *nethttp.Request) {
				if db == nil {
					nethttp.Error(w, "db down", nethttp.StatusServiceUnavailable)
					return
				}
				if err := db.PingContext(r.Context()); err != nil {
					nethttp.Error(w, "db down", nethttp.StatusServiceUnavailable)
					return
				}

				w.WriteHeader(nethttp.StatusOK)
				_, _ = w.Write([]byte("db ok"))
			})
		})
	})

	_ = chi.Walk(r, func(method string, route string, handler nethttp.Handler, middlewares ...func(nethttp.Handler) nethttp.Handler) error {
		log.Info().
			Str("method", method).
			Str("route", route).
			Msg("registered route")
		return nil
	})

	return r
}
