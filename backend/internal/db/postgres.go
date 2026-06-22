package db

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"net/url"
	"time"

	"mappening/internal/config"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func New(cfg config.DBConfig) (*sql.DB, error) {
	db, err := sql.Open("pgx", postgresDSN(cfg))
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxConns)
	db.SetMaxIdleConns(cfg.MaxIdle)
	db.SetConnMaxLifetime(cfg.MaxLifetime)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}

	return db, nil
}

func postgresDSN(cfg config.DBConfig) string {
	values := url.Values{}
	values.Set("sslmode", cfg.SSLMode)
	values.Set("application_name", "mappening")

	u := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(cfg.User, cfg.Password),
		Host:     net.JoinHostPort(cfg.Host, cfg.Port),
		Path:     cfg.Name,
		RawQuery: values.Encode(),
	}

	return u.String()
}
