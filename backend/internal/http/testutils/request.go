package testutils

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"
)

func NewJSONRequest(t *testing.T, method, url string, body any) *http.Request {
	t.Helper()

	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode json: %v", err)
		}
	}

	req, err := http.NewRequest(method, url, &buf)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	return req
}

func SetOrigin(req *http.Request, origin string) {
	req.Header.Set("Origin", origin)
}

func SetCSRF(req *http.Request, token string) {
	req.Header.Set("X-CSRF-Token", token)
}
