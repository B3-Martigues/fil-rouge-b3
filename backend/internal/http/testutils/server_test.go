package testutils

import (
	"io"
	"net/http"
	"testing"
)

func TestNewTestServer_ServesHealthEndpoint(t *testing.T) {
	srv := NewTestServer(t)

	res, err := http.Get(srv.URL + "/api/health")
	if err != nil {
		t.Fatalf("GET /api/health: %v", err)
	}
	defer res.Body.Close()

	RequireStatus(t, res, http.StatusOK)

	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}
	if string(body) != "ok" {
		t.Fatalf("expected health body ok, got %q", string(body))
	}
}
