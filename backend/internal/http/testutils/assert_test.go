package testutils

import (
	"net/http"
	"testing"
	"time"
)

func TestFindCookie(t *testing.T) {
	cookies := []*http.Cookie{
		{Name: "access_token", Value: "abc"},
		{Name: "refresh_token", Value: "def"},
	}

	if got := FindCookie(cookies, "refresh_token"); got == nil || got.Value != "def" {
		t.Fatalf("expected refresh cookie, got %#v", got)
	}
	if got := FindCookie(cookies, "csrf_token"); got != nil {
		t.Fatalf("expected nil for missing cookie")
	}
}

func TestRequireCookie_ReturnsMatchingCookie(t *testing.T) {
	httpOnly := true
	secure := false
	sameSite := http.SameSiteStrictMode
	maxAge := 120
	cookies := []*http.Cookie{{
		Name:     "access_token",
		Value:    "abc",
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteStrictMode,
		Expires:  time.Now().Add(time.Hour),
		MaxAge:   maxAge,
	}}

	got := RequireCookie(t, cookies, CookieSpec{
		Name:          "access_token",
		Path:          "/",
		HttpOnly:      &httpOnly,
		Secure:        &secure,
		SameSite:      &sameSite,
		ExpectExpires: true,
		MaxAge:        &maxAge,
	})

	if got.Value != "abc" {
		t.Fatalf("expected returned cookie value abc, got %q", got.Value)
	}
}

func TestPointerHelpers(t *testing.T) {
	if got := BoolPtr(true); got == nil || !*got {
		t.Fatalf("BoolPtr did not return pointer to true")
	}
	if got := SameSitePtr(http.SameSiteLaxMode); got == nil || *got != http.SameSiteLaxMode {
		t.Fatalf("SameSitePtr did not return pointer to SameSiteLaxMode")
	}
	if got := IntPtr(7); got == nil || *got != 7 {
		t.Fatalf("IntPtr did not return pointer to 7")
	}
}
