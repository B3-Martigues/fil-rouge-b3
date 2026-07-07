package users

import (
	"context"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"mappening/internal/contracts"
)

type AdminService interface {
	List(ctx context.Context) ([]User, error)
	Create(ctx context.Context, req contracts.CreateAdminUserDTO) (*User, error)
	Update(ctx context.Context, id int64, currentUserID int64, req contracts.UpdateAdminUserDTO) (*User, error)
	Delete(ctx context.Context, id int64, currentUserID int64) error
	ResetPassword(ctx context.Context, id int64, req contracts.ResetPasswordDTO) error
}

type adminRepository interface {
	List(ctx context.Context) ([]User, error)
	Create(ctx context.Context, user *User) (int64, error)
	GetByID(ctx context.Context, id int64) (*User, error)
	UpdatePreservingAdminAccess(ctx context.Context, currentUserID int64, user *User, passwordHash *string) error
	UpdatePassword(ctx context.Context, userID int64, passwordHash string) error
	DeletePreservingAdminAccess(ctx context.Context, currentUserID int64, userID int64) (*User, error)
}

type adminSessionStore interface {
	Delete(subject string) error
}

type DefaultAdminService struct {
	Repo         adminRepository
	SessionStore adminSessionStore
}

func NewAdminService(repo adminRepository, sessionStore adminSessionStore) DefaultAdminService {
	return DefaultAdminService{Repo: repo, SessionStore: sessionStore}
}

func (s DefaultAdminService) List(ctx context.Context) ([]User, error) {
	return s.repo().List(ctx)
}

func (s DefaultAdminService) Create(ctx context.Context, req contracts.CreateAdminUserDTO) (*User, error) {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Role = strings.TrimSpace(strings.ToLower(req.Role))

	if req.Email == "" || req.Role == "" {
		return nil, ErrInvalidAdminUserInput("missing required fields")
	}
	if err := validateUserProfile(req.Email, req.FirstName, req.LastName); err != nil {
		return nil, err
	}
	if !isAllowedRole(req.Role) {
		return nil, ErrInvalidAdminUserInput("invalid role")
	}
	if err := validateNewPassword(req.Password); err != nil {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &User{
		Email:        req.Email,
		PasswordHash: string(hash),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Role:         req.Role,
		IsActive:     req.IsActive,
	}

	id, err := s.repo().Create(ctx, user)
	if err != nil {
		return nil, err
	}
	user.ID = id
	return user, nil
}

func (s DefaultAdminService) Update(ctx context.Context, id int64, currentUserID int64, req contracts.UpdateAdminUserDTO) (*User, error) {
	user, err := s.repo().GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	originalUser := *user

	if req.Email != nil {
		email := strings.TrimSpace(strings.ToLower(*req.Email))
		if email == "" {
			return nil, ErrInvalidAdminUserInput("email is required")
		}
		user.Email = email
	}
	if req.FirstName != nil {
		user.FirstName = strings.TrimSpace(*req.FirstName)
	}
	if req.LastName != nil {
		user.LastName = strings.TrimSpace(*req.LastName)
	}
	if req.Role != nil {
		user.Role = strings.TrimSpace(strings.ToLower(*req.Role))
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}

	if user.Email == "" {
		return nil, ErrInvalidAdminUserInput("email is required")
	}
	if user.Role == "" {
		return nil, ErrInvalidAdminUserInput("role is required")
	}
	if !isAllowedRole(user.Role) {
		return nil, ErrInvalidAdminUserInput("invalid role")
	}
	if err := validateUserProfile(user.Email, user.FirstName, user.LastName); err != nil {
		return nil, err
	}

	var passwordHash *string
	if req.Password != nil {
		password := *req.Password
		if password != "" {
			if err := validateNewPassword(password); err != nil {
				return nil, err
			}
			hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				return nil, err
			}
			hashValue := string(hash)
			passwordHash = &hashValue
		}
	}

	if err := s.repo().UpdatePreservingAdminAccess(ctx, currentUserID, user, passwordHash); err != nil {
		return nil, err
	}

	authStateChanged := passwordHash != nil ||
		originalUser.Email != user.Email ||
		originalUser.Role != user.Role ||
		originalUser.IsActive != user.IsActive
	if authStateChanged {
		if err := s.revokeSessions(originalUser.Email, user.Email); err != nil {
			return nil, err
		}
	}

	return user, nil
}

func (s DefaultAdminService) Delete(ctx context.Context, id int64, currentUserID int64) error {
	deletedUser, err := s.repo().DeletePreservingAdminAccess(ctx, currentUserID, id)
	if err != nil {
		return err
	}
	return s.revokeSessions(deletedUser.Email)
}

func (s DefaultAdminService) ResetPassword(ctx context.Context, id int64, req contracts.ResetPasswordDTO) error {
	user, err := s.repo().GetByID(ctx, id)
	if err != nil {
		return err
	}
	if err := validateNewPassword(req.Password); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err := s.repo().UpdatePassword(ctx, id, string(hash)); err != nil {
		return err
	}
	return s.revokeSessions(user.Email)
}

func (s DefaultAdminService) repo() adminRepository {
	return s.Repo
}

func (s DefaultAdminService) revokeSessions(subjects ...string) error {
	if s.SessionStore == nil {
		return nil
	}

	seen := make(map[string]struct{}, len(subjects))
	for _, subject := range subjects {
		normalized := strings.TrimSpace(strings.ToLower(subject))
		if normalized == "" {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}

		if err := s.SessionStore.Delete(normalized); err != nil {
			return err
		}
	}

	return nil
}

type ErrInvalidAdminUserInput string

func (e ErrInvalidAdminUserInput) Error() string {
	return string(e)
}
