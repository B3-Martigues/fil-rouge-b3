package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"mappening/internal/config"
	"mappening/internal/http/middleware"
)

const testAccessSecret = "test-secret"
const testAccessIssuer = "mappening-test"

func signedAccessToken(t *testing.T, role string) string {
	t.Helper()

	claims := middleware.UserClaims{
		UserID: 1,
		Email:  role + "@mappening.test",
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    testAccessIssuer,
			Subject:   role + "@mappening.test",
			Audience:  []string{"access"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(testAccessSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func testRouter() http.Handler {
	return NewRouter(config.Config{
		Env:               "test",
		FrontendURL:       "http://localhost:5173",
		JWTSecret:         testAccessSecret,
		JWTIssuer:         testAccessIssuer,
		JWTTTL:            time.Hour,
		RefreshTTL:        24 * time.Hour,
		MediaUploadDir:    "uploads",
		PublicDocsEnabled: true,
	}, nil, nil)
}

func performAccessRequest(router http.Handler, method string, path string, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	req.Header.Set("Origin", "http://localhost:5173")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func TestAccessMatrix_PublicAndProtectedRoutes(t *testing.T) {
	router := testRouter()

	tests := []struct {
		name   string
		method string
		path   string
		token  string
		want   int
	}{
		{
			name:   "visitor can read health endpoint",
			method: http.MethodGet,
			path:   "/api/health",
			want:   http.StatusOK,
		},
		{
			name:   "visitor cannot read current account",
			method: http.MethodGet,
			path:   "/api/auth/me",
			want:   http.StatusUnauthorized,
		},
		{
			name:   "invalid token is rejected",
			method: http.MethodGet,
			path:   "/api/auth/me",
			token:  "invalid",
			want:   http.StatusUnauthorized,
		},
		{
			name:   "regular user cannot access admin users",
			method: http.MethodGet,
			path:   "/api/admin/users",
			token:  signedAccessToken(t, "user"),
			want:   http.StatusForbidden,
		},
		{
			name:   "moderator cannot access admin users",
			method: http.MethodGet,
			path:   "/api/admin/users",
			token:  signedAccessToken(t, "moderator"),
			want:   http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := performAccessRequest(router, tt.method, tt.path, tt.token)
			if rec.Code != tt.want {
				t.Fatalf("expected %d, got %d: %s", tt.want, rec.Code, rec.Body.String())
			}
			if rec.Header().Get("Content-Type") == "" && tt.want != http.StatusOK {
				t.Fatalf("expected JSON error content type for protected endpoint")
			}
		})
	}
}

func TestRequireRole_AllowsOnlyExpectedRoles(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	handler := middleware.AuthJWT(testAccessSecret, testAccessIssuer, "test")(
		middleware.RequireRole("admin", "moderator")(next),
	)

	tests := []struct {
		role string
		want int
	}{
		{role: "user", want: http.StatusForbidden},
		{role: "organization", want: http.StatusForbidden},
		{role: "moderator", want: http.StatusNoContent},
		{role: "admin", want: http.StatusNoContent},
	}

	for _, tt := range tests {
		t.Run(tt.role, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/protected", nil)
			req.Header.Set("Authorization", "Bearer "+signedAccessToken(t, tt.role))
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tt.want {
				t.Fatalf("expected %d, got %d: %s", tt.want, rec.Code, rec.Body.String())
			}
		})
	}
}
