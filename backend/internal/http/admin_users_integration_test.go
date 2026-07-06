package http_test

import (
	"net/http"
	"testing"

	"mappening/internal/http/testutils"
)

func TestAdminUsersRoutes_RequireAuth_AndConfiguredRepo(t *testing.T) {
	cfg := testutils.TestConfig()
	srv := testutils.NewTestServer(t)
	tc := testutils.NewClient(t, srv.URL)

	t.Run("list requires authentication", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/users", nil)
		res, err := tc.Client.Do(req)
		if err != nil {
			t.Fatalf("list request failed: %v", err)
		}
		res.Body.Close()

		if res.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 before login, got %d", res.StatusCode)
		}
	})

	t.Run("login requires configured repository", func(t *testing.T) {
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
			t.Fatalf("expected 500 without configured auth repo, got %d", res.StatusCode)
		}
	})

	t.Run("list stays unauthenticated without fake login", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/users", nil)
		res, err := tc.Client.Do(req)
		if err != nil {
			t.Fatalf("list request failed: %v", err)
		}
		res.Body.Close()

		if res.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 without authenticated user, got %d", res.StatusCode)
		}
	})

	t.Run("create requires csrf token", func(t *testing.T) {
		req := testutils.NewJSONRequest(t, http.MethodPost, srv.URL+"/api/admin/users", map[string]any{
			"email":      "new@mappening.local",
			"password":   "secret123456",
			"first_name": "Jane",
			"last_name":  "Doe",
			"role":       "admin",
			"is_active":  true,
		})
		testutils.SetOrigin(req, cfg.FrontendURL)

		res, err := tc.Client.Do(req)
		if err != nil {
			t.Fatalf("create request failed: %v", err)
		}
		res.Body.Close()

		if res.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 without CSRF token, got %d", res.StatusCode)
		}
	})
}
