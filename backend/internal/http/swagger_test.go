package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSwaggerRoutesArePublic(t *testing.T) {
	router := testRouter()

	tests := []struct {
		name        string
		path        string
		wantStatus  int
		contentType string
		bodyPart    string
	}{
		{
			name:        "openapi spec",
			path:        "/openapi.yaml",
			wantStatus:  http.StatusOK,
			contentType: "application/yaml",
			bodyPart:    "openapi: 3.0.3",
		},
		{
			name:        "swagger ui",
			path:        "/swagger/",
			wantStatus:  http.StatusOK,
			contentType: "text/html",
			bodyPart:    "SwaggerUIBundle",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			res := rec.Result()
			if res.StatusCode != tt.wantStatus {
				t.Fatalf("expected status %d, got %d: %s", tt.wantStatus, res.StatusCode, rec.Body.String())
			}
			if got := res.Header.Get("Content-Type"); !strings.Contains(got, tt.contentType) {
				t.Fatalf("expected Content-Type containing %q, got %q", tt.contentType, got)
			}
			if !strings.Contains(rec.Body.String(), tt.bodyPart) {
				t.Fatalf("expected body to contain %q", tt.bodyPart)
			}
		})
	}
}
