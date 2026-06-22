package httpx

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestParseOptionalBoolFormValue(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/example", strings.NewReader(""))

	value, err := ParseOptionalBoolFormValue(req, "send_notification", true)
	if err != nil {
		t.Fatalf("expected default bool without error, got %v", err)
	}
	if !value {
		t.Fatalf("expected default value to be returned when field is missing")
	}
}

func TestParseOptionalBoolFormValue_InvalidValue(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/example", strings.NewReader("enabled=maybe"))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	if err := req.ParseForm(); err != nil {
		t.Fatalf("parse form: %v", err)
	}

	_, err := ParseOptionalBoolFormValue(req, "enabled", true)
	if err == nil {
		t.Fatalf("expected invalid bool form value to fail")
	}
}

func TestParseIDParam(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/example/42", nil)
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("exampleID", "42")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, routeContext))

	value, err := ParseIDParam(req, "exampleID")
	if err != nil {
		t.Fatalf("expected route id to parse, got %v", err)
	}
	if value != 42 {
		t.Fatalf("expected route id 42, got %d", value)
	}
}

func TestCurrentUserIDFromContext(t *testing.T) {
	ctx := WithCurrentUserID(context.Background(), 9)

	value, err := CurrentUserIDFromContext(ctx)
	if err != nil {
		t.Fatalf("expected user id to be resolved, got %v", err)
	}
	if value != 9 {
		t.Fatalf("expected user id 9, got %d", value)
	}
}
