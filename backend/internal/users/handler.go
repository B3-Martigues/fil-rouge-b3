package users

import (
	"context"
	"errors"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"

	"mappening/internal/contracts"
	"mappening/internal/httpx"
)

var allowedRoles = map[string]struct{}{
	"admin":        {},
	"moderator":    {},
	"organization": {},
	"user":         {},
}

var (
	ErrSelfAdminAccessRemoval = errors.New("you cannot remove your own active admin access")
	ErrSelfDeletion           = errors.New("you cannot delete your own account")
	ErrLastActiveAdmin        = errors.New("cannot remove the last active admin")
)

type AdminHandler struct {
	UserRepo     adminUserRepository
	SessionStore adminUserSessionStore
}

type adminUserRepository interface {
	List(ctx context.Context) ([]User, error)
	Create(ctx context.Context, user *User) (int64, error)
	GetByID(ctx context.Context, id int64) (*User, error)
	UpdatePreservingAdminAccess(ctx context.Context, currentUserID int64, user *User, passwordHash *string) error
	UpdatePassword(ctx context.Context, userID int64, passwordHash string) error
	DeletePreservingAdminAccess(ctx context.Context, currentUserID int64, userID int64) (*User, error)
}

type adminUserSessionStore interface {
	Delete(subject string) error
}

// Retourne la liste admin des utilisateurs.
func (h AdminHandler) List(w http.ResponseWriter, r *http.Request) {
	if h.UserRepo == nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "user repository not configured")
		return
	}

	users, err := h.UserRepo.List(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("list users failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	resp := make([]contracts.AdminUserDTO, 0, len(users))
	for _, u := range users {
		resp = append(resp, toAdminUserDTO(u))
	}

	httpx.WriteJSON(w, http.StatusOK, resp)
}

// Cree un nouvel utilisateur avec mot de passe hashé.
func (h AdminHandler) Create(w http.ResponseWriter, r *http.Request) {
	if h.UserRepo == nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "user repository not configured")
		return
	}

	var req contracts.CreateAdminUserDTO
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Role = strings.TrimSpace(strings.ToLower(req.Role))

	if req.Email == "" || req.Role == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "missing required fields")
		return
	}
	if err := validateUserProfile(req.Email, req.FirstName, req.LastName); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !isAllowedRole(req.Role) {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid role")
		return
	}
	if err := validateNewPassword(req.Password); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Error().Err(err).Msg("create user: hash password failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	user := &User{
		Email:        req.Email,
		PasswordHash: string(hash),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Role:         req.Role,
		IsActive:     req.IsActive,
	}

	id, err := h.UserRepo.Create(r.Context(), user)
	if err != nil {
		log.Error().Err(err).Str("email", req.Email).Msg("create user failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	user.ID = id

	httpx.WriteJSON(w, http.StatusCreated, toAdminUserDTO(*user))
}

// Met a jour un utilisateur et revoque ses sessions si son etat d'auth change.
func (h AdminHandler) Update(w http.ResponseWriter, r *http.Request) {
	if h.UserRepo == nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "user repository not configured")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	user, err := h.UserRepo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httpx.WriteJSONError(w, http.StatusNotFound, "user not found")
			return
		}
		log.Error().Err(err).Msg("update user: get user failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	originalUser := *user

	var req contracts.UpdateAdminUserDTO
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Email != nil {
		email := strings.TrimSpace(strings.ToLower(*req.Email))
		if email == "" {
			httpx.WriteJSONError(w, http.StatusBadRequest, "email is required")
			return
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
		httpx.WriteJSONError(w, http.StatusBadRequest, "email is required")
		return
	}
	if user.Role == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "role is required")
		return
	}
	if !isAllowedRole(user.Role) {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid role")
		return
	}
	if err := validateUserProfile(user.Email, user.FirstName, user.LastName); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	var passwordHash *string
	if req.Password != nil {
		password := *req.Password
		if password != "" {
			if err := validateNewPassword(password); err != nil {
				httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
				return
			}

			hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				log.Error().Err(err).Msg("update user: hash password failed")
				httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
				return
			}

			hashValue := string(hash)
			passwordHash = &hashValue
		}
	}

	currentUserID, _ := httpx.CurrentUserIDFromContext(r.Context())
	if err := h.UserRepo.UpdatePreservingAdminAccess(r.Context(), currentUserID, user, passwordHash); err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httpx.WriteJSONError(w, http.StatusNotFound, "user not found")
			return
		}
		if isAdminProtectionError(err) {
			httpx.WriteJSONError(w, http.StatusConflict, err.Error())
			return
		}
		log.Error().Err(err).Msg("update user failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	authStateChanged := passwordHash != nil ||
		originalUser.Email != user.Email ||
		originalUser.Role != user.Role ||
		originalUser.IsActive != user.IsActive

	if authStateChanged {
		if err := h.revokeSessions(originalUser.Email, user.Email); err != nil {
			log.Error().Err(err).Int64("user_id", user.ID).Msg("update user: revoke sessions failed")
			httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
			return
		}
	}

	httpx.WriteJSON(w, http.StatusOK, toAdminUserDTO(*user))
}

// Supprime un utilisateur puis invalide ses sessions actives.
func (h AdminHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if h.UserRepo == nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "user repository not configured")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	currentUserID, _ := httpx.CurrentUserIDFromContext(r.Context())
	deletedUser, err := h.UserRepo.DeletePreservingAdminAccess(r.Context(), currentUserID, id)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httpx.WriteJSONError(w, http.StatusNotFound, "user not found")
			return
		}
		if isAdminProtectionError(err) {
			httpx.WriteJSONError(w, http.StatusConflict, err.Error())
			return
		}
		log.Error().Err(err).Msg("delete user failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if err := h.revokeSessions(deletedUser.Email); err != nil {
		log.Error().Err(err).Int64("user_id", id).Msg("delete user: revoke sessions failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Reinitialise le mot de passe d'un utilisateur puis force une reconnexion.
func (h AdminHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	if h.UserRepo == nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "user repository not configured")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	user, err := h.UserRepo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httpx.WriteJSONError(w, http.StatusNotFound, "user not found")
			return
		}
		log.Error().Err(err).Msg("reset password: get user failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	var req contracts.ResetPasswordDTO
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := validateNewPassword(req.Password); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Error().Err(err).Msg("reset password: hash failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if err := h.UserRepo.UpdatePassword(r.Context(), id, string(hash)); err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httpx.WriteJSONError(w, http.StatusNotFound, "user not found")
			return
		}
		log.Error().Err(err).Msg("reset password failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if err := h.revokeSessions(user.Email); err != nil {
		log.Error().Err(err).Int64("user_id", id).Msg("reset password: revoke sessions failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Supprime les sessions associees a une ou plusieurs identites normalisees.
func (h AdminHandler) revokeSessions(subjects ...string) error {
	if h.SessionStore == nil {
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

		if err := h.SessionStore.Delete(normalized); err != nil {
			return err
		}
	}

	return nil
}

// Applique les regles minimales de robustesse sur un mot de passe administrateur.
func validateNewPassword(password string) error {
	const (
		minPasswordLength = 12
		maxPasswordLength = 128
	)

	if strings.TrimSpace(password) == "" {
		return errors.New("password cannot be blank")
	}
	if password != strings.TrimSpace(password) {
		return errors.New("password cannot start or end with whitespace")
	}
	if utf8.RuneCountInString(password) < minPasswordLength {
		return errors.New("password too short")
	}
	if utf8.RuneCountInString(password) > maxPasswordLength {
		return errors.New("password too long")
	}
	for _, r := range password {
		if unicode.IsControl(r) {
			return errors.New("password cannot contain control characters")
		}
	}

	return nil
}

// Valide les champs utilisateur avant ecriture afin d'eviter des erreurs SQL
// exposees sous forme de 500 et de garder les contraintes proches de l'API.
func validateUserProfile(email, firstName, lastName string) error {
	if err := validateEmail(email); err != nil {
		return err
	}
	if err := validateDisplayName("first_name", firstName); err != nil {
		return err
	}
	if err := validateDisplayName("last_name", lastName); err != nil {
		return err
	}

	return nil
}

func validateEmail(email string) error {
	const maxEmailLength = 254

	if email == "" {
		return errors.New("email is required")
	}
	if len(email) > maxEmailLength {
		return errors.New("email is too long")
	}
	if strings.ContainsAny(email, " \t\r\n") {
		return errors.New("email is invalid")
	}

	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email {
		return errors.New("email is invalid")
	}

	parts := strings.Split(email, "@")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return errors.New("email is invalid")
	}

	return nil
}

func validateDisplayName(field string, value string) error {
	const maxNameLength = 100

	if utf8.RuneCountInString(value) > maxNameLength {
		return errors.New(field + " is too long")
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return errors.New(field + " cannot contain control characters")
		}
	}

	return nil
}

func isAdminProtectionError(err error) bool {
	return errors.Is(err, ErrSelfAdminAccessRemoval) ||
		errors.Is(err, ErrSelfDeletion) ||
		errors.Is(err, ErrLastActiveAdmin)
}

// Convertit le modele utilisateur en DTO admin sans exposer le hash du mot de passe.
func toAdminUserDTO(user User) contracts.AdminUserDTO {
	return contracts.AdminUserDTO{
		ID:        user.ID,
		Email:     user.Email,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Role:      user.Role,
		IsActive:  user.IsActive,
	}
}

// Verifie que le role demande fait partie de la liste blanche.
func isAllowedRole(role string) bool {
	_, ok := allowedRoles[strings.TrimSpace(strings.ToLower(role))]
	return ok
}

func isActiveAdmin(user User) bool {
	return strings.EqualFold(strings.TrimSpace(user.Role), "admin") && user.IsActive
}
