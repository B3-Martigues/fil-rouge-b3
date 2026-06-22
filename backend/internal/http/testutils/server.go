package testutils

import (
	"net/http/httptest"
	"testing"

	httpapi "mappening/internal/http"
)

func NewTestServer(t *testing.T) *httptest.Server {
	t.Helper()

	cfg := TestConfig()
	srv := httptest.NewServer(httpapi.NewRouter(cfg, nil))
	t.Cleanup(srv.Close)
	return srv
}
