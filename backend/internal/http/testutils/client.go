package testutils

import (
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"testing"
)

type TestClient struct {
	Client *http.Client
	Jar    *cookiejar.Jar
	Base   string
}

func NewClient(t *testing.T, baseURL string) *TestClient {
	t.Helper()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("cookiejar.New: %v", err)
	}

	return &TestClient{
		Client: &http.Client{Jar: jar},
		Jar:    jar,
		Base:   baseURL,
	}
}

func mustParseURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	return u
}

// Cookie path "/" (`csrf_token`, `access_token`)
func (tc *TestClient) RootCookie(t *testing.T, name string) *http.Cookie {
	t.Helper()
	u := mustParseURL(t, tc.Base+"/")
	for _, c := range tc.Jar.Cookies(u) {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// Cookie path "/api/auth" (`refresh_token`)
func (tc *TestClient) AuthCookie(t *testing.T, name string) *http.Cookie {
	t.Helper()
	// n'importe quelle URL sous /api/auth fonctionne
	u := mustParseURL(t, tc.Base+"/api/auth/refresh")
	for _, c := range tc.Jar.Cookies(u) {
		if c.Name == name {
			return c
		}
	}
	return nil
}
