package testutils

import (
	"net/http"
	"net/url"
	"testing"
)

func TestNewClient_StoresCookiesByPath(t *testing.T) {
	tc := NewClient(t, "http://example.test")
	base, err := url.Parse(tc.Base)
	if err != nil {
		t.Fatalf("parse base URL: %v", err)
	}

	tc.Jar.SetCookies(base, []*http.Cookie{
		{Name: "csrf_token", Value: "root", Path: "/"},
		{Name: "refresh_token", Value: "auth", Path: "/api/auth"},
	})

	if got := tc.RootCookie(t, "csrf_token"); got == nil || got.Value != "root" {
		t.Fatalf("expected root cookie, got %#v", got)
	}
	if got := tc.AuthCookie(t, "refresh_token"); got == nil || got.Value != "auth" {
		t.Fatalf("expected auth cookie, got %#v", got)
	}
	if got := tc.RootCookie(t, "missing"); got != nil {
		t.Fatalf("expected missing root cookie to return nil")
	}
}
