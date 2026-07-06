package middleware_test

import (
	"net/http"
	"testing"

	"mappening/internal/http/testutils"
)

func TestJWTProtectedRoutes_Me_UnauthorizedWithoutConfiguredAuthRepo(t *testing.T) {
	cfg := testutils.TestConfig()
	srv := testutils.NewTestServer(t)
	tc := testutils.NewClient(t, srv.URL)

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

		if res.StatusCode != http.StatusInternalServerError {
			t.Fatalf("expected 500 on login without configured repo, got %d", res.StatusCode)
		}
	}

	{
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/auth/me", nil)
		res, err := tc.Client.Do(req)
		if err != nil {
			t.Fatalf("me request failed: %v", err)
		}
		res.Body.Close()

		if res.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 after failed login, got %d", res.StatusCode)
		}
	}
}

func TestJWTProtectedRoutes_RejectsInvalidBearerToken(t *testing.T) {
	srv := testutils.NewTestServer(t)

	bearerReq, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/auth/me", nil)
	bearerReq.Header.Set("Authorization", "Bearer not-a-valid-access-token")

	bearerRes, err := (&http.Client{}).Do(bearerReq)
	if err != nil {
		t.Fatalf("bearer request failed: %v", err)
	}
	bearerRes.Body.Close()

	if bearerRes.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 when using invalid bearer token, got %d", bearerRes.StatusCode)
	}
}
