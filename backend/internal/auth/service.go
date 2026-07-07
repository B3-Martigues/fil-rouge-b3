package auth

import (
	"context"
	"errors"
	"time"

	"mappening/internal/users"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserInactive       = errors.New("user inactive")
)

type AuthService struct {
	userRepo authUserStore
}

// Construit le service d'authentification a partir du repository utilisateurs.
func NewAuthService(userRepo authUserStore) *AuthService {
	return &AuthService{
		userRepo: userRepo,
	}
}

type authUserStore interface {
	authUserReader
	authUserCreator
	authOrganizationCreator
	authUserPasswordUpdater
	authUserProfileUpdater
	authPasswordResetter
	authUserPreferencesService
	authUserNotificationsService
	authUserDeleter
}

// Verifie les identifiants d'un utilisateur et refuse les comptes inactifs ou suspendus.
func (s *AuthService) Login(ctx context.Context, email, password string) (*users.User, error) {
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	if user == nil {
		return nil, ErrInvalidCredentials
	}

	if !isUserAllowedToAuthenticate(user) {
		return nil, ErrUserInactive
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return user, nil
}

func (s *AuthService) GetByEmail(ctx context.Context, email string) (*users.User, error) {
	return s.userRepo.GetByEmail(ctx, email)
}

func (s *AuthService) Create(ctx context.Context, user *users.User) (int64, error) {
	return s.userRepo.Create(ctx, user)
}

func (s *AuthService) CreateOrganization(ctx context.Context, registration users.OrganizationRegistration) (*users.User, int64, error) {
	return s.userRepo.CreateOrganization(ctx, registration)
}

func (s *AuthService) UpdatePassword(ctx context.Context, userID int64, passwordHash string) error {
	return s.userRepo.UpdatePassword(ctx, userID, passwordHash)
}

func (s *AuthService) UpdateProfile(ctx context.Context, accountID int64, email string, username string) (*users.User, error) {
	return s.userRepo.UpdateProfile(ctx, accountID, email, username)
}

func (s *AuthService) CreatePasswordResetToken(ctx context.Context, email string, token string, expiresAt time.Time) (bool, error) {
	return s.userRepo.CreatePasswordResetToken(ctx, email, token, expiresAt)
}

func (s *AuthService) ResetPasswordWithToken(ctx context.Context, token string, passwordHash string) error {
	return s.userRepo.ResetPasswordWithToken(ctx, token, passwordHash)
}

func (s *AuthService) ListEventPreferences(ctx context.Context, accountID int64) ([]users.EventPreference, error) {
	return s.userRepo.ListEventPreferences(ctx, accountID)
}

func (s *AuthService) ReplaceEventPreferences(ctx context.Context, accountID int64, categorySlugs []string) ([]users.EventPreference, error) {
	return s.userRepo.ReplaceEventPreferences(ctx, accountID, categorySlugs)
}

func (s *AuthService) ListNotificationTypes(ctx context.Context) ([]users.NotificationType, error) {
	return s.userRepo.ListNotificationTypes(ctx)
}

func (s *AuthService) ListNotifications(ctx context.Context, accountID int64) ([]users.Notification, error) {
	return s.userRepo.ListNotifications(ctx, accountID)
}

func (s *AuthService) MarkNotificationRead(ctx context.Context, accountID int64, notificationID int64) (*users.Notification, error) {
	return s.userRepo.MarkNotificationRead(ctx, accountID, notificationID)
}

func (s *AuthService) MarkAllNotificationsRead(ctx context.Context, accountID int64) error {
	return s.userRepo.MarkAllNotificationsRead(ctx, accountID)
}

func (s *AuthService) Deactivate(ctx context.Context, userID int64) error {
	return s.userRepo.Deactivate(ctx, userID)
}

func (s *AuthService) Delete(ctx context.Context, userID int64) error {
	return s.userRepo.Delete(ctx, userID)
}

func isUserAllowedToAuthenticate(user *users.User) bool {
	return user != nil && user.IsActive && !user.IsSuspended(time.Now().UTC())
}
