package testutils

import (
	"net/http"
	"testing"
	"time"
)

func RequireStatus(t *testing.T, res *http.Response, code int) {
	t.Helper()
	if res.StatusCode != code {
		t.Fatalf("expected status %d, got %d", code, res.StatusCode)
	}
}

func FindCookie(cookies []*http.Cookie, name string) *http.Cookie {
	for _, c := range cookies {
		if c.Name == name {
			return c
		}
	}
	return nil
}

type CookieSpec struct {
	Name     string
	Path     string
	HttpOnly *bool
	Secure   *bool
	SameSite *http.SameSite
	// optionnel : on peut vérifier qu’il y a une date d’expiration
	ExpectExpires bool
	// optionnel : max age (ex: -1 au logout)
	MaxAge *int
}

func RequireCookie(t *testing.T, cookies []*http.Cookie, spec CookieSpec) *http.Cookie {
	t.Helper()

	c := FindCookie(cookies, spec.Name)
	if c == nil {
		t.Fatalf("expected cookie '%s' to be set", spec.Name)
	}

	if spec.Path != "" && c.Path != spec.Path {
		t.Fatalf("cookie %s: expected Path '%s', got '%s'", spec.Name, spec.Path, c.Path)
	}
	if spec.HttpOnly != nil && c.HttpOnly != *spec.HttpOnly {
		t.Fatalf("cookie %s: expected HttpOnly=%v, got %v", spec.Name, *spec.HttpOnly, c.HttpOnly)
	}
	if spec.Secure != nil && c.Secure != *spec.Secure {
		t.Fatalf("cookie %s: expected Secure=%v, got %v", spec.Name, *spec.Secure, c.Secure)
	}
	if spec.SameSite != nil && c.SameSite != *spec.SameSite {
		t.Fatalf("cookie %s: expected SameSite=%v, got %v", spec.Name, *spec.SameSite, c.SameSite)
	}
	if spec.ExpectExpires {
		// expires peut être zéro si pas set; dans ton code il est set pour access/refresh/csrf en login/refresh
		if c.Expires.IsZero() {
			t.Fatalf("cookie %s: expected Expires to be set", spec.Name)
		}
		// petit controle de coherence
		if c.Expires.Before(time.Unix(0, 0)) {
			t.Fatalf("cookie %s: Expires looks invalid: %v", spec.Name, c.Expires)
		}
	}
	if spec.MaxAge != nil && c.MaxAge != *spec.MaxAge {
		t.Fatalf("cookie %s: expected MaxAge=%d, got %d", spec.Name, *spec.MaxAge, c.MaxAge)
	}

	return c
}

func BoolPtr(v bool) *bool                       { return &v }
func SameSitePtr(v http.SameSite) *http.SameSite { return &v }
func IntPtr(v int) *int                          { return &v }
