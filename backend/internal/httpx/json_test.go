package httpx

import (
	"bytes"
	"net/http/httptest"
	"testing"
)

func TestDecodeStrictJSON_RejectsTrailingPayload(t *testing.T) {
	req := httptest.NewRequest("POST", "/test", bytes.NewBufferString(`{"name":"ok"}{"extra":true}`))
	rec := httptest.NewRecorder()

	var payload struct {
		Name string `json:"name"`
	}
	err := DecodeStrictJSON(rec, req, &payload)
	if err == nil {
		t.Fatalf("expected trailing JSON payload to be rejected")
	}
}

func TestDecodeStrictJSON_AcceptsSingleObjectWithTrailingWhitespace(t *testing.T) {
	req := httptest.NewRequest("POST", "/test", bytes.NewBufferString("{\"name\":\"ok\"}\n \t"))
	rec := httptest.NewRecorder()

	var payload struct {
		Name string `json:"name"`
	}
	if err := DecodeStrictJSON(rec, req, &payload); err != nil {
		t.Fatalf("expected valid JSON to be accepted, got %v", err)
	}
	if payload.Name != "ok" {
		t.Fatalf("expected decoded payload, got %+v", payload)
	}
}
