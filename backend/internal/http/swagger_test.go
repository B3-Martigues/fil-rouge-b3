package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"mappening/internal/config"
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

func TestSwaggerRoutesAreDisabledUnlessConfigured(t *testing.T) {
	router := NewRouter(config.Config{
		Env:               "test",
		FrontendURL:       "http://localhost:5173",
		JWTSecret:         testAccessSecret,
		JWTIssuer:         testAccessIssuer,
		JWTTTL:            time.Hour,
		RefreshTTL:        24 * time.Hour,
		MediaUploadDir:    "uploads",
		PublicDocsEnabled: false,
	}, nil, nil)

	for _, path := range []string{"/openapi.yaml", "/swagger/"} {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Result().StatusCode != http.StatusNotFound {
				t.Fatalf("expected status 404, got %d", rec.Result().StatusCode)
			}
		})
	}
}
