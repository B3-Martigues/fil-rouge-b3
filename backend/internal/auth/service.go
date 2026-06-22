package auth

import (
	"context"
	"errors"

	"mappening/internal/users"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserInactive       = errors.New("user inactive")
)

type AuthService struct {
	userRepo *users.Repository
}

// Construit le service d'authentification a partir du repository utilisateurs.
func NewAuthService(userRepo *users.Repository) *AuthService {
	return &AuthService{
		userRepo: userRepo,
	}
}

// Verifie les identifiants d'un utilisateur et refuse les comptes inactifs.
func (s *AuthService) Login(ctx context.Context, email, password string) (*users.User, error) {
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	if user == nil {
		return nil, ErrInvalidCredentials
	}

	if !user.IsActive {
		return nil, ErrUserInactive
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return user, nil
}
