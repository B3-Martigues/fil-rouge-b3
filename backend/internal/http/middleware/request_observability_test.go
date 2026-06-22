package middleware

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func TestRequestID_UsesSafeIncomingHeader(t *testing.T) {
	handler := RequestID()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := GetRequestID(r.Context()); got != "req-123" {
			t.Fatalf("expected request id in context, got %q", got)
		}

		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set(RequestIDHeader, "req-123")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if got := rec.Result().Header.Get(RequestIDHeader); got != "req-123" {
		t.Fatalf("expected echoed request id header, got %q", got)
	}
}

func TestRequestID_GeneratesHeaderWhenMissingOrInvalid(t *testing.T) {
	handler := RequestID()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if GetRequestID(r.Context()) == "" {
			t.Fatalf("expected generated request id in context")
		}

		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set(RequestIDHeader, "bad value with spaces")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if got := rec.Result().Header.Get(RequestIDHeader); got == "" || got == "bad value with spaces" {
		t.Fatalf("expected generated request id header, got %q", got)
	}
}

func TestAccessLog_LogsStructuredRequestFields(t *testing.T) {
	var output bytes.Buffer
	previousLogger := log.Logger
	log.Logger = zerolog.New(&output)
	t.Cleanup(func() {
		log.Logger = previousLogger
	})

	handler := RequestID()(AccessLog()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.RemoteAddr = "203.0.113.10:41234"
	req.Header.Set(RequestIDHeader, "req-456")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	var payload map[string]any
	if err := json.Unmarshal(output.Bytes(), &payload); err != nil {
		t.Fatalf("decode log payload: %v", err)
	}

	if payload["message"] != "http request" {
		t.Fatalf("expected access log message, got %+v", payload)
	}
	if payload["request_id"] != "req-456" {
		t.Fatalf("expected request_id in log, got %+v", payload["request_id"])
	}
	if payload["method"] != "GET" || payload["path"] != "/api/test" {
		t.Fatalf("expected method/path in log, got %+v", payload)
	}
	if payload["status"] != float64(http.StatusOK) {
		t.Fatalf("expected status 200 in log, got %+v", payload["status"])
	}
}
