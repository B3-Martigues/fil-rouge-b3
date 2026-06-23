package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"mime"
	"net"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"

	"mappening/internal/config"
	"mappening/internal/contracts"
	"mappening/internal/http/middleware"
	"mappening/internal/httpx"
	"mappening/internal/users"
)

type Handler struct {
	Secret           string
	Issuer           string
	AccessTTL        time.Duration
	RefreshTTL       time.Duration
	CookieSecure     bool
	CSRFCookieDomain string
	Env              string
	FrontendURL      string

	DevLoginEnabled bool
	DevLoginEmail   string

	Store    RefreshTokenStore
	UserRepo authUserReader
}

const dummyPasswordHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

type authUserReader interface {
	GetByEmail(ctx context.Context, email string) (*users.User, error)
}

type authUserCreator interface {
	Create(ctx context.Context, user *users.User) (int64, error)
}

type authOrganizationCreator interface {
	CreateOrganization(ctx context.Context, registration users.OrganizationRegistration) (*users.User, int64, error)
}

type authUserPasswordUpdater interface {
	UpdatePassword(ctx context.Context, userID int64, passwordHash string) error
}

type authUserDeleter interface {
	Deactivate(ctx context.Context, userID int64) error
	Delete(ctx context.Context, userID int64) error
}

func (h Handler) Login(w http.ResponseWriter, r *http.Request) {
	if h.UserRepo == nil || h.Store == nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "auth service not configured")
		return
	}

	if !isJSONContentType(r.Header.Get("Content-Type")) {
		httpx.WriteJSONError(w, http.StatusUnsupportedMediaType, "content type must be application/json")
		return
	}

	if !isAllowedBrowserOrigin(r, h.FrontendURL) {
		httpx.WriteJSONError(w, http.StatusForbidden, "invalid origin")
		return
	}

	var req contracts.LoginRequestDTO
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		log.Error().
			Err(err).
			Msg("login: invalid request body")

		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Email == "" || strings.TrimSpace(req.Password) == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	if len(req.Email) > 254 || len(req.Password) > 4096 {
		httpx.WriteJSONError(w, http.StatusBadRequest, "request fields are too large")
		return
	}

	user, err := h.UserRepo.GetByEmail(r.Context(), req.Email)
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			_ = bcrypt.CompareHashAndPassword([]byte(dummyPasswordHash), []byte(req.Password))
			log.Warn().
				Str("email", req.Email).
				Msg("login failed: invalid credentials")

			httpx.WriteJSONError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}

		log.Error().
			Err(err).
			Str("email", req.Email).
			Msg("login failed: repository error")

		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if !user.IsActive {
		_ = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
		log.Warn().
			Str("email", user.Email).
			Msg("login failed: invalid credentials")

		httpx.WriteJSONError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		log.Warn().
			Str("email", user.Email).
			Msg("login failed: invalid credentials")

		httpx.WriteJSONError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	csrf, ok := h.startSession(w, user, "login failed")
	if !ok {
		return
	}

	log.Info().
		Str("email", user.Email).
		Str("role", user.Role).
		Msg("login success")

	writeLoginResponse(w, user, csrf)
}

func (h Handler) RegisterUser(w http.ResponseWriter, r *http.Request) {
	creator, ok := h.UserRepo.(authUserCreator)
	if h.UserRepo == nil || h.Store == nil || !ok {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "auth service not configured")
		return
	}

	if !isJSONContentType(r.Header.Get("Content-Type")) {
		httpx.WriteJSONError(w, http.StatusUnsupportedMediaType, "content type must be application/json")
		return
	}
	if !isAllowedBrowserOrigin(r, h.FrontendURL) {
		httpx.WriteJSONError(w, http.StatusForbidden, "invalid origin")
		return
	}

	var req contracts.RegisterUserRequestDTO
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	email := normalizeEmail(firstNonBlank(req.LoginEmail, req.Email))
	username := strings.TrimSpace(req.Username)
	if err := validatePublicRegistration(email, username, req.Password); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Error().Err(err).Msg("register user: hash password failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	user := &users.User{
		Email:        email,
		PasswordHash: string(hash),
		FirstName:    username,
		Role:         "user",
		AccountType:  "user",
		IsActive:     true,
	}
	id, err := creator.Create(r.Context(), user)
	if err != nil {
		writeAuthMutationError(w, err)
		return
	}
	user.ID = id

	csrf, ok := h.startSession(w, user, "register user failed")
	if !ok {
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, contracts.LoginResponseDTO{
		OK:        true,
		User:      toAuthUserDTO(user),
		CSRFToken: csrf,
	})
}

func (h Handler) RegisterOrganization(w http.ResponseWriter, r *http.Request) {
	creator, ok := h.UserRepo.(authOrganizationCreator)
	if h.UserRepo == nil || h.Store == nil || !ok {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "auth service not configured")
		return
	}

	if !isJSONContentType(r.Header.Get("Content-Type")) {
		httpx.WriteJSONError(w, http.StatusUnsupportedMediaType, "content type must be application/json")
		return
	}
	if !isAllowedBrowserOrigin(r, h.FrontendURL) {
		httpx.WriteJSONError(w, http.StatusForbidden, "invalid origin")
		return
	}

	var req contracts.RegisterOrganizationRequestDTO
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	email := normalizeEmail(firstNonBlank(req.LoginEmail, req.Email))
	memberName := strings.TrimSpace(req.MemberName)
	if err := validatePublicRegistration(email, memberName, req.Password); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.ContactEmail) == "" ||
		strings.TrimSpace(req.Address) == "" || strings.TrimSpace(req.City) == "" ||
		strings.TrimSpace(req.PostalCode) == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "organization fields are required")
		return
	}
	if err := validateEmail(normalizeEmail(req.ContactEmail)); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "contact email is invalid")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Error().Err(err).Msg("register organization: hash password failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	user, organizationID, err := creator.CreateOrganization(r.Context(), users.OrganizationRegistration{
		Email:              email,
		PasswordHash:       string(hash),
		MemberName:         memberName,
		MemberJobRole:      strings.TrimSpace(req.MemberJobRole),
		Name:               strings.TrimSpace(req.Name),
		ContactEmail:       normalizeEmail(req.ContactEmail),
		Description:        strings.TrimSpace(req.Description),
		Website:            strings.TrimSpace(req.Website),
		Address:            strings.TrimSpace(req.Address),
		City:               strings.TrimSpace(req.City),
		PostalCode:         strings.TrimSpace(req.PostalCode),
		Logo:               strings.TrimSpace(req.Logo),
		ContactPhoneNumber: strings.TrimSpace(req.ContactPhoneNumber),
		SIRET:              strings.TrimSpace(req.SIRET),
		IsVerified:         false,
		IsActive:           false,
	})
	if err != nil {
		writeAuthMutationError(w, err)
		return
	}

	csrf, ok := h.startSession(w, user, "register organization failed")
	if !ok {
		return
	}

	dto := toAuthUserDTO(user)
	dto.OrganizationID = &organizationID
	httpx.WriteJSON(w, http.StatusCreated, contracts.LoginResponseDTO{
		OK:        true,
		User:      dto,
		CSRFToken: csrf,
	})
}

func (h Handler) DevLogin(w http.ResponseWriter, r *http.Request) {
	if !h.DevLoginEnabled || !config.IsDevLikeEnv(h.Env) {
		http.NotFound(w, r)
		return
	}

	if h.UserRepo == nil || h.Store == nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "auth service not configured")
		return
	}

	if !isLoopbackRequest(r) {
		httpx.WriteJSONError(w, http.StatusForbidden, "local dev login is only available from loopback")
		return
	}
	if !isLoopbackRequestHost(r) {
		httpx.WriteJSONError(w, http.StatusForbidden, "local dev login is only available on a loopback host")
		return
	}

	if !isAllowedBrowserOrigin(r, h.FrontendURL) {
		httpx.WriteJSONError(w, http.StatusForbidden, "invalid origin")
		return
	}

	email := strings.TrimSpace(strings.ToLower(h.DevLoginEmail))
	if email == "" {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "dev login is not configured")
		return
	}

	user, err := h.UserRepo.GetByEmail(r.Context(), email)
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			httpx.WriteJSONError(w, http.StatusUnauthorized, "dev login user not found")
			return
		}

		log.Error().
			Err(err).
			Str("email", email).
			Msg("dev login failed: repository error")

		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if !user.IsActive {
		httpx.WriteJSONError(w, http.StatusForbidden, "user inactive")
		return
	}

	csrf, ok := h.startSession(w, user, "dev login failed")
	if !ok {
		return
	}

	log.Info().
		Str("email", user.Email).
		Str("role", user.Role).
		Msg("dev login success")

	writeLoginResponse(w, user, csrf)
}

func (h Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	if h.UserRepo == nil || h.Store == nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "auth service not configured")
		return
	}

	c, err := r.Cookie("refresh_token")
	if err != nil || c.Value == "" {
		log.Warn().Msg("refresh failed: missing refresh token")

		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing refresh token")
		return
	}

	claims := &middleware.UserClaims{}
	token, err := jwt.ParseWithClaims(c.Value, claims, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, jwt.ErrTokenSignatureInvalid
		}
		return []byte(h.Secret), nil
	})

	if err != nil || !token.Valid {
		log.Warn().Msg("refresh failed: invalid refresh token")

		httpx.WriteJSONError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	if claims.Subject == "" || claims.Issuer != h.Issuer {
		log.Warn().Msg("refresh failed: invalid token claims")

		httpx.WriteJSONError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	if !hasAudience(claims.Audience, "refresh") {
		log.Warn().Msg("refresh failed: invalid token audience")

		httpx.WriteJSONError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	if claims.ID == "" {
		log.Warn().Msg("refresh failed: missing token id")

		httpx.WriteJSONError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	current, ok, err := h.Store.Get(claims.Subject)
	if err != nil {
		log.Error().
			Err(err).
			Str("email", claims.Subject).
			Msg("refresh failed: refresh store error")

		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if !ok || current != claims.ID {
		log.Warn().
			Str("email", claims.Subject).
			Msg("refresh failed: token revoked")

		httpx.WriteJSONError(w, http.StatusUnauthorized, "refresh token revoked")
		return
	}

	user, err := h.UserRepo.GetByEmail(r.Context(), claims.Subject)
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			log.Warn().
				Str("email", claims.Subject).
				Msg("refresh failed: user not found")

			httpx.WriteJSONError(w, http.StatusUnauthorized, "user not found")
			return
		}

		log.Error().
			Err(err).
			Str("email", claims.Subject).
			Msg("refresh failed: repository error")

		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if !user.IsActive {
		log.Warn().
			Str("email", user.Email).
			Msg("refresh failed: user inactive")

		httpx.WriteJSONError(w, http.StatusForbidden, "user inactive")
		return
	}
	if !refreshClaimsMatchCurrentUser(user, claims) {
		log.Warn().
			Str("email", user.Email).
			Msg("refresh failed: stale user state")

		httpx.WriteJSONError(w, http.StatusUnauthorized, "refresh token revoked")
		return
	}

	access, accessExp, refresh, refreshExp, newJTI, err := h.issueTokens(user)
	if err != nil {
		log.Error().
			Err(err).
			Str("email", user.Email).
			Msg("refresh failed: token generation error")

		httpx.WriteJSONError(w, http.StatusInternalServerError, "token error")
		return
	}

	rotated, err := h.Store.CompareAndSwapWithExpiry(user.Email, claims.ID, newJTI, refreshExp)
	if err != nil {
		log.Error().
			Err(err).
			Str("email", user.Email).
			Msg("refresh failed: refresh store compare-and-swap error")

		httpx.WriteJSONError(w, http.StatusInternalServerError, "token error")
		return
	}
	if !rotated {
		log.Warn().
			Str("email", user.Email).
			Msg("refresh failed: token rotation lost race")

		httpx.WriteJSONError(w, http.StatusUnauthorized, "refresh token revoked")
		return
	}

	csrf, err := randomHex(32)
	if err != nil {
		log.Error().
			Err(err).
			Str("email", user.Email).
			Msg("refresh failed: csrf generation error")

		httpx.WriteJSONError(w, http.StatusInternalServerError, "token error")
		return
	}
	setCsrfCookie(w, csrf, refreshExp, CookieOpts{Secure: h.CookieSecure, CSRFCookieDomain: h.CSRFCookieDomain})
	setAuthCookies(w, access, accessExp, refresh, refreshExp, CookieOpts{Secure: h.CookieSecure})
	writeCSRFHeader(w, csrf)

	log.Info().
		Str("email", user.Email).
		Msg("refresh success")

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "csrf_token": csrf})
}

func (h Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if h.Store == nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "auth service not configured")
		return
	}

	if u := middleware.GetUser(r); u != nil {
		if err := h.Store.Delete(u.Email); err != nil {
			log.Error().
				Err(err).
				Str("email", u.Email).
				Msg("logout failed: refresh store error")

			httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
			return
		}

		log.Info().
			Str("email", u.Email).
			Msg("logout success")
	} else {
		log.Warn().Msg("logout: no authenticated user in context")
	}

	clearAuthCookies(w, CookieOpts{Secure: h.CookieSecure, CSRFCookieDomain: h.CSRFCookieDomain})

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h Handler) Me(w http.ResponseWriter, r *http.Request) {
	if h.UserRepo == nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "auth service not configured")
		return
	}

	claimsUser := middleware.GetUser(r)
	if claimsUser == nil {
		log.Warn().Msg("me failed: no user in context")

		httpx.WriteJSONError(w, http.StatusUnauthorized, "no user")
		return
	}

	user, err := h.UserRepo.GetByEmail(r.Context(), claimsUser.Email)
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			log.Warn().
				Str("email", claimsUser.Email).
				Msg("me failed: user not found")

			httpx.WriteJSONError(w, http.StatusUnauthorized, "user not found")
			return
		}

		log.Error().
			Err(err).
			Str("email", claimsUser.Email).
			Msg("me failed: repository error")

		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if !user.IsActive {
		log.Warn().
			Str("email", user.Email).
			Msg("me failed: user inactive")

		httpx.WriteJSONError(w, http.StatusForbidden, "user inactive")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, toAuthUserDTO(user))
}

func (h Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	updater, ok := h.UserRepo.(authUserPasswordUpdater)
	if h.UserRepo == nil || !ok {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "auth service not configured")
		return
	}

	claimsUser := middleware.GetUser(r)
	if claimsUser == nil {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "no user")
		return
	}

	var req contracts.ChangePasswordRequestDTO
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	currentPassword := firstNonBlank(req.CurrentPassword, req.OldPassword)
	if strings.TrimSpace(currentPassword) == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "current password is required")
		return
	}
	if err := validatePassword(req.NewPassword); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	user, err := h.UserRepo.GetByEmail(r.Context(), claimsUser.Email)
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			httpx.WriteJSONError(w, http.StatusUnauthorized, "user not found")
			return
		}
		log.Error().Err(err).Msg("change password: get user failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "invalid password")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Error().Err(err).Msg("change password: hash password failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := updater.UpdatePassword(r.Context(), user.ID, string(hash)); err != nil {
		writeAuthMutationError(w, err)
		return
	}
	if h.Store != nil {
		_ = h.Store.Delete(user.Email)
	}
	clearAuthCookies(w, CookieOpts{Secure: h.CookieSecure, CSRFCookieDomain: h.CSRFCookieDomain})

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h Handler) CheckRole(w http.ResponseWriter, r *http.Request) {
	claimsUser := middleware.GetUser(r)
	if claimsUser == nil {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "no user")
		return
	}

	expected := strings.TrimSpace(strings.ToLower(strings.TrimPrefix(r.URL.Path, "/api/auth/check-role/")))
	actual := strings.TrimSpace(strings.ToLower(claimsUser.Role))
	httpx.WriteJSON(w, http.StatusOK, contracts.AuthCheckResponseDTO{
		OK:      true,
		Allowed: expected != "" && actual == expected,
		Actual:  actual,
	})
}

func (h Handler) CheckAccountType(w http.ResponseWriter, r *http.Request) {
	claimsUser := middleware.GetUser(r)
	if claimsUser == nil {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "no user")
		return
	}

	user, err := h.UserRepo.GetByEmail(r.Context(), claimsUser.Email)
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			httpx.WriteJSONError(w, http.StatusUnauthorized, "user not found")
			return
		}
		log.Error().Err(err).Msg("check account type: get user failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	expected := strings.TrimSpace(strings.ToLower(strings.TrimPrefix(r.URL.Path, "/api/auth/check-account-type/")))
	actual := strings.TrimSpace(strings.ToLower(user.AccountType))
	httpx.WriteJSON(w, http.StatusOK, contracts.AuthCheckResponseDTO{
		OK:      true,
		Allowed: expected != "" && actual == expected,
		Actual:  actual,
	})
}

func (h Handler) DeactivateAccount(w http.ResponseWriter, r *http.Request) {
	h.closeOwnAccount(w, r, false)
}

func (h Handler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	h.closeOwnAccount(w, r, true)
}

func (h Handler) closeOwnAccount(w http.ResponseWriter, r *http.Request, delete bool) {
	deleter, ok := h.UserRepo.(authUserDeleter)
	if h.UserRepo == nil || !ok {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "auth service not configured")
		return
	}

	claimsUser := middleware.GetUser(r)
	if claimsUser == nil {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "no user")
		return
	}
	if claimsUser.Role == "admin" {
		httpx.WriteJSONError(w, http.StatusForbidden, "insufficient permissions")
		return
	}

	var err error
	if delete {
		err = deleter.Delete(r.Context(), claimsUser.UserID)
	} else {
		err = deleter.Deactivate(r.Context(), claimsUser.UserID)
	}
	if err != nil {
		writeAuthMutationError(w, err)
		return
	}

	if h.Store != nil {
		_ = h.Store.Delete(claimsUser.Email)
	}
	clearAuthCookies(w, CookieOpts{Secure: h.CookieSecure, CSRFCookieDomain: h.CSRFCookieDomain})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h Handler) issueTokens(user *users.User) (access string, accessExp time.Time, refresh string, refreshExp time.Time, refreshJTI string, err error) {
	now := time.Now()

	accessExp = now.Add(h.AccessTTL)
	accessClaims := middleware.UserClaims{
		UserID:          user.ID,
		Email:           user.Email,
		Role:            user.Role,
		SessionRevision: userSessionRevision(user.UpdatedAt),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    h.Issuer,
			Subject:   user.Email,
			Audience:  []string{"access"},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(accessExp),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	access, err = accessToken.SignedString([]byte(h.Secret))
	if err != nil {
		return
	}

	refreshExp = now.Add(h.RefreshTTL)
	refreshJTI, err = randomHex(16)
	if err != nil {
		return
	}
	refreshClaims := middleware.UserClaims{
		UserID:          user.ID,
		Email:           user.Email,
		Role:            user.Role,
		SessionRevision: userSessionRevision(user.UpdatedAt),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    h.Issuer,
			Subject:   user.Email,
			Audience:  []string{"refresh"},
			ID:        refreshJTI,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(refreshExp),
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refresh, err = refreshToken.SignedString([]byte(h.Secret))
	return
}

func (h Handler) startSession(w http.ResponseWriter, user *users.User, failurePrefix string) (string, bool) {
	access, accessExp, refresh, refreshExp, refreshJTI, err := h.issueTokens(user)
	if err != nil {
		log.Error().
			Err(err).
			Str("email", user.Email).
			Msg(failurePrefix + ": token generation error")

		httpx.WriteJSONError(w, http.StatusInternalServerError, "token error")
		return "", false
	}

	if err := h.Store.SetWithExpiry(user.Email, refreshJTI, refreshExp); err != nil {
		log.Error().
			Err(err).
			Str("email", user.Email).
			Msg(failurePrefix + ": refresh store error")

		httpx.WriteJSONError(w, http.StatusInternalServerError, "token error")
		return "", false
	}

	csrf, err := randomHex(32)
	if err != nil {
		log.Error().
			Err(err).
			Str("email", user.Email).
			Msg(failurePrefix + ": csrf generation error")

		httpx.WriteJSONError(w, http.StatusInternalServerError, "token error")
		return "", false
	}

	setCsrfCookie(w, csrf, refreshExp, CookieOpts{Secure: h.CookieSecure, CSRFCookieDomain: h.CSRFCookieDomain})
	setAuthCookies(w, access, accessExp, refresh, refreshExp, CookieOpts{Secure: h.CookieSecure})
	writeCSRFHeader(w, csrf)
	return csrf, true
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func userSessionRevision(updatedAt time.Time) int64 {
	if updatedAt.IsZero() {
		return 0
	}

	return updatedAt.UTC().UnixMicro()
}

func hasAudience(audiences []string, expected string) bool {
	for _, audience := range audiences {
		if audience == expected {
			return true
		}
	}

	return false
}

func toAuthUserDTO(user *users.User) contracts.AuthUserDTO {
	accountID := user.ID
	if user.AccountID != 0 {
		accountID = user.AccountID
	}
	username := strings.TrimSpace(user.FirstName)
	if username == "" {
		username = strings.TrimSpace(user.LastName)
	}
	if username == "" {
		username = strings.Split(user.Email, "@")[0]
	}
	accountType := user.AccountType
	if accountType == "" {
		accountType = user.Role
	}
	return contracts.AuthUserDTO{
		ID:          user.ID,
		AccountID:   accountID,
		UserID:      user.ProfileID,
		Email:       user.Email,
		LoginEmail:  user.Email,
		FirstName:   user.FirstName,
		LastName:    user.LastName,
		Username:    username,
		Role:        user.Role,
		AccountType: accountType,
		IsActive:    user.IsActive,
	}
}

func writeLoginResponse(w http.ResponseWriter, user *users.User, csrf string) {
	httpx.WriteJSON(w, http.StatusOK, contracts.LoginResponseDTO{
		OK:        true,
		User:      toAuthUserDTO(user),
		CSRFToken: csrf,
	})
}

func writeCSRFHeader(w http.ResponseWriter, csrf string) {
	w.Header().Set("X-CSRF-Token", csrf)
}

func isLoopbackRequest(r *http.Request) bool {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err != nil {
		host = strings.TrimSpace(r.RemoteAddr)
	}

	host = strings.Trim(host, "[]")
	if strings.EqualFold(host, "localhost") {
		return true
	}

	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func isLoopbackRequestHost(r *http.Request) bool {
	host := strings.TrimSpace(r.Host)
	if host == "" {
		return false
	}

	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		host = parsedHost
	}

	return config.IsLoopbackHost(host)
}

func refreshClaimsMatchCurrentUser(user *users.User, claims *middleware.UserClaims) bool {
	if user == nil || claims == nil {
		return false
	}
	if user.ID != claims.UserID {
		return false
	}
	if !strings.EqualFold(user.Email, claims.Subject) {
		return false
	}
	if user.Role != claims.Role {
		return false
	}

	currentRevision := userSessionRevision(user.UpdatedAt)
	if currentRevision == 0 {
		return true
	}

	return claims.SessionRevision == currentRevision
}

func isAllowedBrowserOrigin(r *http.Request, frontendURL string) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin != "" {
		return matchesAllowedOrigin(origin, frontendURL)
	}

	referer := strings.TrimSpace(r.Header.Get("Referer"))
	if referer == "" {
		return false
	}

	return matchesAllowedOrigin(referer, frontendURL)
}

func matchesAllowedOrigin(candidate string, frontendURL string) bool {
	candidateURL, err := url.Parse(candidate)
	if err != nil {
		return false
	}

	allowedURL, err := url.Parse(strings.TrimSpace(frontendURL))
	if err != nil {
		return false
	}

	return strings.EqualFold(candidateURL.Scheme, allowedURL.Scheme) &&
		strings.EqualFold(candidateURL.Host, allowedURL.Host)
}

func isJSONContentType(rawContentType string) bool {
	mediaType, _, err := mime.ParseMediaType(strings.TrimSpace(rawContentType))
	if err != nil {
		return false
	}

	return mediaType == "application/json" || strings.HasSuffix(mediaType, "+json")
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func normalizeEmail(email string) string {
	return strings.TrimSpace(strings.ToLower(email))
}

func validatePublicRegistration(email, username, password string) error {
	if err := validateEmail(email); err != nil {
		return err
	}
	if strings.TrimSpace(username) == "" {
		return errors.New("username is required")
	}
	if utf8.RuneCountInString(username) > 100 {
		return errors.New("username is too long")
	}
	for _, r := range username {
		if unicode.IsControl(r) {
			return errors.New("username cannot contain control characters")
		}
	}
	return validatePassword(password)
}

func validateEmail(email string) error {
	if email == "" || len(email) > 254 || strings.ContainsAny(email, " \t\r\n") {
		return errors.New("email is invalid")
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email {
		return errors.New("email is invalid")
	}
	return nil
}

func validatePassword(password string) error {
	if strings.TrimSpace(password) == "" {
		return errors.New("password is required")
	}
	if password != strings.TrimSpace(password) {
		return errors.New("password cannot start or end with whitespace")
	}
	if utf8.RuneCountInString(password) < 8 {
		return errors.New("password too short")
	}
	if utf8.RuneCountInString(password) > 128 {
		return errors.New("password too long")
	}
	for _, r := range password {
		if unicode.IsControl(r) {
			return errors.New("password cannot contain control characters")
		}
	}
	return nil
}

func writeAuthMutationError(w http.ResponseWriter, err error) {
	if errors.Is(err, users.ErrEmailAlreadyUsed) {
		httpx.WriteJSONError(w, http.StatusConflict, "email already used")
		return
	}
	if errors.Is(err, users.ErrUsernameAlreadyUsed) {
		httpx.WriteJSONError(w, http.StatusConflict, "username already used")
		return
	}
	if errors.Is(err, users.ErrUserNotFound) {
		httpx.WriteJSONError(w, http.StatusNotFound, "user not found")
		return
	}

	log.Error().Err(err).Msg("auth mutation failed")
	httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
}
