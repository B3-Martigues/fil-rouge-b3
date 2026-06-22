package testutils

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestNewJSONRequest_EncodesBodyAndHeaders(t *testing.T) {
	req := NewJSONRequest(t, http.MethodPost, "http://example.test/api", map[string]string{
		"name": "Ada",
	})

	if req.Method != http.MethodPost {
		t.Fatalf("expected POST, got %s", req.Method)
	}
	if got := req.Header.Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected JSON content type, got %q", got)
	}

	var body map[string]string
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		t.Fatalf("decode request body: %v", err)
	}
	if body["name"] != "Ada" {
		t.Fatalf("expected encoded body, got %#v", body)
	}
}

func TestSetOriginAndCSRF(t *testing.T) {
	req := NewJSONRequest(t, http.MethodPost, "http://example.test/api", nil)

	SetOrigin(req, "http://localhost:5173")
	SetCSRF(req, "csrf-token")

	if got := req.Header.Get("Origin"); got != "http://localhost:5173" {
		t.Fatalf("expected Origin header, got %q", got)
	}
	if got := req.Header.Get("X-CSRF-Token"); got != "csrf-token" {
		t.Fatalf("expected CSRF header, got %q", got)
	}
}
