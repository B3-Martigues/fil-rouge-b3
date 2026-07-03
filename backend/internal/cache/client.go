package cache

import (
	"context"
	"fmt"

	"mappening/internal/config"

	"github.com/redis/go-redis/v9"
)

// Client encapsule le client Redis utilisé par l'application.
type Client struct {
	*redis.Client
}
// New initialise un client Redis à partir de la configuration de
// l'application et vérifie immédiatement la connexion avec un PING.
// Une erreur est renvoyée si le serveur Redis n'est pas accessible.
func New(cfg config.RedisConfig) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}

	return &Client{Client: rdb}, nil
}