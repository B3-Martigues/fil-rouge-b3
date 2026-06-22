package middleware_test

import (
	"net/http"
	"testing"

	"mappening/internal/http/testutils"
)

func TestJWTProtectedRoutes_Me_UnauthorizedThenAuthorized(t *testing.T) {
	cfg := testutils.TestConfig()
	srv := testutils.NewTestServer(t)
	tc := testutils.NewClient(t, srv.URL)

	// 1) Sans login => /me doit être 401
	{
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/auth/me", nil)
		res, err := tc.Client.Do(req)
		if err != nil {
			t.Fatalf("me request failed: %v", err)
		}
		res.Body.Close()

		if res.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 before login, got %d", res.StatusCode)
		}
	}

	// 2) Login
	{
		req := testutils.NewJSONRequest(t, http.MethodPost, srv.URL+"/api/auth/login", map[string]string{
			"email":    "admin@mappening.local",
			"password": "admin1234",
		})
		testutils.SetOrigin(req, cfg.FrontendURL)

		res, err := tc.Client.Do(req)
		if err != nil {
			t.Fatalf("login request failed: %v", err)
		}
		res.Body.Close()

		if res.StatusCode != 200 {
			t.Fatalf("expected 200 on login, got %d", res.StatusCode)
		}

		// Controle simple: access_token doit etre present dans le jar (Path="/")
		if tc.RootCookie(t, "access_token") == nil {
			t.Fatalf("expected access_token in jar after login")
		}
	}

	// 3) Après login => /me doit être 200
	{
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/auth/me", nil)
		res, err := tc.Client.Do(req)
		if err != nil {
			t.Fatalf("me request failed: %v", err)
		}
		res.Body.Close()

		if res.StatusCode != 200 {
			t.Fatalf("expected 200 after login, got %d", res.StatusCode)
		}
	}
}

func TestJWTProtectedRoutes_RejectsRefreshTokenAsBearer(t *testing.T) {
	cfg := testutils.TestConfig()
	srv := testutils.NewTestServer(t)
	tc := testutils.NewClient(t, srv.URL)

	loginReq := testutils.NewJSONRequest(t, http.MethodPost, srv.URL+"/api/auth/login", map[string]string{
		"email":    "admin@mappening.local",
		"password": "admin1234",
	})
	testutils.SetOrigin(loginReq, cfg.FrontendURL)

	loginRes, err := tc.Client.Do(loginReq)
	if err != nil {
		t.Fatalf("login request failed: %v", err)
	}
	loginRes.Body.Close()

	if loginRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on login, got %d", loginRes.StatusCode)
	}

	refreshToken := tc.AuthCookie(t, "refresh_token")
	if refreshToken == nil {
		t.Fatalf("expected refresh_token after login")
	}

	bearerReq, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/auth/me", nil)
	bearerReq.Header.Set("Authorization", "Bearer "+refreshToken.Value)

	bearerRes, err := (&http.Client{}).Do(bearerReq)
	if err != nil {
		t.Fatalf("bearer request failed: %v", err)
	}
	bearerRes.Body.Close()

	if bearerRes.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 when using refresh token as bearer, got %d", bearerRes.StatusCode)
	}
}
