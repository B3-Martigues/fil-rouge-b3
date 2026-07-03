package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"mappening/internal/users"
)

type fakeJWTUserRepo struct {
	user *users.User
	err  error
}

func (f fakeJWTUserRepo) GetByEmail(_ context.Context, _ string) (*users.User, error) {
	if f.err != nil {
		return nil, f.err
	}
	if f.user == nil {
		return nil, users.ErrUserNotFound
	}

	cloned := *f.user
	return &cloned, nil
}

func TestAuthJWTWithUserLookup_AcceptsCurrentUserState(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	user := &users.User{
		ID:        7,
		Email:     "user@mappening.local",
		Role:      "admin",
		IsActive:  true,
		UpdatedAt: now,
	}

	protected := AuthJWTWithUserLookup("test-secret", "mappening", "prod", fakeJWTUserRepo{user: user})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{
		Name: "access_token",
		Value: signedJWTClaims(t, "test-secret", UserClaims{
			UserID:          user.ID,
			Email:           user.Email,
			Role:            user.Role,
			SessionRevision: user.UpdatedAt.UTC().UnixMicro(),
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    "mappening",
				Subject:   user.Email,
				Audience:  []string{"access"},
				IssuedAt:  jwt.NewNumericDate(now.Add(time.Second)),
				ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
			},
		}),
	})
	rec := httptest.NewRecorder()

	protected.ServeHTTP(rec, req)

	if rec.Result().StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Result().StatusCode)
	}
}

func TestAuthJWTWithUserLookup_RejectsChangedRoleImmediately(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	user := &users.User{
		ID:        7,
		Email:     "user@mappening.local",
		Role:      "employee",
		IsActive:  true,
		UpdatedAt: now,
	}

	protected := AuthJWTWithUserLookup("test-secret", "mappening", "prod", fakeJWTUserRepo{user: user})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{
		Name: "access_token",
		Value: signedJWTClaims(t, "test-secret", UserClaims{
			UserID:          user.ID,
			Email:           user.Email,
			Role:            "admin",
			SessionRevision: user.UpdatedAt.UTC().UnixMicro(),
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    "mappening",
				Subject:   user.Email,
				Audience:  []string{"access"},
				IssuedAt:  jwt.NewNumericDate(now.Add(time.Second)),
				ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
			},
		}),
	})
	rec := httptest.NewRecorder()

	protected.ServeHTTP(rec, req)

	if rec.Result().StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Result().StatusCode)
	}
}

func TestAuthJWTWithUserLookup_RejectsSuspendedUserImmediately(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	suspendedUntil := now.Add(time.Hour)
	user := &users.User{
		ID:             7,
		Email:          "user@mappening.local",
		Role:           "admin",
		IsActive:       true,
		SuspendedUntil: &suspendedUntil,
		UpdatedAt:      now,
	}

	protected := AuthJWTWithUserLookup("test-secret", "mappening", "prod", fakeJWTUserRepo{user: user})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{
		Name: "access_token",
		Value: signedJWTClaims(t, "test-secret", UserClaims{
			UserID:          user.ID,
			Email:           user.Email,
			Role:            user.Role,
			SessionRevision: user.UpdatedAt.UTC().UnixMicro(),
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    "mappening",
				Subject:   user.Email,
				Audience:  []string{"access"},
				IssuedAt:  jwt.NewNumericDate(now.Add(time.Second)),
				ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
			},
		}),
	})
	rec := httptest.NewRecorder()

	protected.ServeHTTP(rec, req)

	if rec.Result().StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Result().StatusCode)
	}
}

func TestAuthJWTWithUserLookup_RejectsOutdatedSessionRevision(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	user := &users.User{
		ID:        7,
		Email:     "user@mappening.local",
		Role:      "admin",
		IsActive:  true,
		UpdatedAt: now.Add(10 * time.Minute),
	}

	protected := AuthJWTWithUserLookup("test-secret", "mappening", "prod", fakeJWTUserRepo{user: user})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{
		Name: "access_token",
		Value: signedJWTClaims(t, "test-secret", UserClaims{
			UserID:          user.ID,
			Email:           user.Email,
			Role:            user.Role,
			SessionRevision: now.UTC().UnixMicro(),
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    "mappening",
				Subject:   user.Email,
				Audience:  []string{"access"},
				IssuedAt:  jwt.NewNumericDate(now.Add(time.Second)),
				ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
			},
		}),
	})
	rec := httptest.NewRecorder()

	protected.ServeHTTP(rec, req)

	if rec.Result().StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Result().StatusCode)
	}
}

func signedJWTClaims(t *testing.T, secret string, claims UserClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	return signed
}
