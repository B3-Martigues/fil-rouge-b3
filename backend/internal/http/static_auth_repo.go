package http

import (
	"context"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"

	"mappening/internal/users"
)

type staticAuthUserRepo struct{}

var (
	staticAdminPasswordHash string
	staticAdminHashOnce     sync.Once
)

func (staticAuthUserRepo) GetByEmail(ctx context.Context, email string) (*users.User, error) {
	_ = ctx

	if strings.TrimSpace(strings.ToLower(email)) != "admin@mappening.local" {
		return nil, users.ErrUserNotFound
	}

	staticAdminHashOnce.Do(func() {
		hash, err := bcrypt.GenerateFromPassword([]byte("admin1234"), bcrypt.DefaultCost)
		if err == nil {
			staticAdminPasswordHash = string(hash)
		}
	})

	if staticAdminPasswordHash == "" {
		return nil, users.ErrUserNotFound
	}

	return &users.User{
		ID:           1,
		Email:        "admin@mappening.local",
		PasswordHash: staticAdminPasswordHash,
		FirstName:    "Admin",
		LastName:     "Mappening",
		Role:         "admin",
		IsActive:     true,
	}, nil
}
