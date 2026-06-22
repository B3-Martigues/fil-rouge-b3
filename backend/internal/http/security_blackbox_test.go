package http_test

import (
	"bytes"
	"encoding/json"
	"mappening/internal/config"
	httpapi "mappening/internal/http"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"
)

func TestSecurity_Blackbox(t *testing.T) {
	// --- Config minimale de test ---
	cfg := config.Config{
		Addr:                   ":0",
		JWTSecret:              "test-secret",
		JWTIssuer:              "mappening",
		JWTTTL:                 10 * time.Second,
		RefreshTTL:             7 * 24 * time.Hour,
		FrontendURL:            "http://localhost:5173",
		CookieSecure:           false,
		Env:                    "test",
		EnableTestAuthFallback: true,
	}

	srv := httptest.NewServer(httpapi.NewRouter(cfg, nil))
	t.Cleanup(srv.Close)

	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar}
	publicClient := &http.Client{}

	// -------------------------------
	// Utilitaires de test
	// -------------------------------

	login := func() *http.Response {
		body := map[string]string{
			"email":    "admin@mappening.local",
			"password": "admin1234",
		}
		b, _ := json.Marshal(body)

		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/login", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", cfg.FrontendURL)

		res, err := client.Do(req)
		if err != nil {
			t.Fatalf("login request failed: %v", err)
		}
		return res
	}

	findCookie := func(cookies []*http.Cookie, name string) *http.Cookie {
		for _, c := range cookies {
			if c.Name == name {
				return c
			}
		}
		return nil
	}

	getCookieFromJar := func(name, path string) *http.Cookie {
		u := mustParseURL(t, srv.URL+path)
		for _, c := range jar.Cookies(u) {
			if c.Name == name {
				return c
			}
		}
		return nil
	}

	// Cookie path "/"
	getRootCookie := func(name string) *http.Cookie {
		return getCookieFromJar(name, "/")
	}

	// Cookie path "/api/auth"
	getAuthCookie := func(name string) *http.Cookie {
		return getCookieFromJar(name, "/api/auth/refresh")
	}

	// -------------------------------
	// TEST 1 : Login OK + flags cookies
	// -------------------------------

	res := login()
	defer res.Body.Close()

	if res.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", res.StatusCode)
	}

	set := res.Cookies()
	csrf := findCookie(set, "csrf_token")
	acc := findCookie(set, "access_token")
	ref := findCookie(set, "refresh_token")

	if csrf == nil || acc == nil || ref == nil {
		t.Fatalf(
			"expected csrf_token, access_token, refresh_token cookies set; got csrf=%v access=%v refresh=%v",
			csrf != nil, acc != nil, ref != nil,
		)
	}

	if csrf.HttpOnly {
		t.Fatalf("csrf_token must NOT be HttpOnly")
	}
	if !acc.HttpOnly {
		t.Fatalf("access_token must be HttpOnly")
	}
	if !ref.HttpOnly {
		t.Fatalf("refresh_token must be HttpOnly")
	}

	if acc.Path != "/" {
		t.Fatalf("access_token Path expected '/', got '%s'", acc.Path)
	}
	if ref.Path != "/api/auth" {
		t.Fatalf("refresh_token Path expected '/api/auth', got '%s'", ref.Path)
	}

	{
		body := map[string]string{
			"email":    "admin@mappening.local",
			"password": "admin1234",
		}
		b, _ := json.Marshal(body)

		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/login", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")

		resWithoutOrigin, err := publicClient.Do(req)
		if err != nil {
			t.Fatalf("login without origin request failed: %v", err)
		}
		resWithoutOrigin.Body.Close()

		if resWithoutOrigin.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 on login without origin, got %d", resWithoutOrigin.StatusCode)
		}
	}

	{
		req, _ := http.NewRequest(
			http.MethodPost,
			srv.URL+"/api/auth/login",
			bytes.NewBufferString(`{"email":"admin@mappening.local","password":"admin1234"}`),
		)
		req.Header.Set("Content-Type", "text/plain")
		req.Header.Set("Origin", cfg.FrontendURL)

		resWrongContentType, err := publicClient.Do(req)
		if err != nil {
			t.Fatalf("login with wrong content-type request failed: %v", err)
		}
		resWrongContentType.Body.Close()

		if resWrongContentType.StatusCode != http.StatusUnsupportedMediaType {
			t.Fatalf("expected 415 on login with non-JSON content-type, got %d", resWrongContentType.StatusCode)
		}
	}

	// -------------------------------
	// TEST 2 : Les routes protegees sont marquees no-store
	// -------------------------------

	{
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/auth/me", nil)

		rMe, err := publicClient.Do(req)
		if err != nil {
			t.Fatalf("me request failed: %v", err)
		}
		rMe.Body.Close()

		if got := rMe.Header.Get("Cache-Control"); got != "no-store, max-age=0" {
			t.Fatalf("expected protected route Cache-Control no-store, got %q", got)
		}
		if got := rMe.Header.Get("Pragma"); got != "no-cache" {
			t.Fatalf("expected protected route Pragma no-cache, got %q", got)
		}
	}

	{
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/users", nil)

		rUsers, err := client.Do(req)
		if err != nil {
			t.Fatalf("admin users request failed: %v", err)
		}
		rUsers.Body.Close()

		if got := rUsers.Header.Get("Cache-Control"); got != "no-store, max-age=0" {
			t.Fatalf("expected protected route Cache-Control no-store, got %q", got)
		}
		if got := rUsers.Header.Get("Pragma"); got != "no-cache" {
			t.Fatalf("expected protected route Pragma no-cache, got %q", got)
		}
	}

	{
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/health", nil)

		rHealth, err := publicClient.Do(req)
		if err != nil {
			t.Fatalf("health request failed: %v", err)
		}
		rHealth.Body.Close()

		if rHealth.StatusCode != http.StatusOK {
			t.Fatalf("expected public health endpoint to return 200, got %d", rHealth.StatusCode)
		}
	}

	{
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/health/db", nil)

		rHealthDB, err := publicClient.Do(req)
		if err != nil {
			t.Fatalf("health db request failed: %v", err)
		}
		rHealthDB.Body.Close()

		if rHealthDB.StatusCode != http.StatusUnauthorized && rHealthDB.StatusCode != http.StatusNotFound {
			t.Fatalf("expected db health endpoint not to be public, got %d", rHealthDB.StatusCode)
		}
	}

	// -------------------------------
	// TEST 3 : CSRF obligatoire sur refresh
	// -------------------------------

	{
		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/refresh", nil)
		req.Header.Set("Origin", cfg.FrontendURL)

		r2, err := client.Do(req)
		if err != nil {
			t.Fatalf("refresh request failed: %v", err)
		}
		r2.Body.Close()

		if r2.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 on refresh without CSRF, got %d", r2.StatusCode)
		}
	}

	// -------------------------------
	// TEST 4 : Origin obligatoire
	// -------------------------------

	{
		csrfJar := getRootCookie("csrf_token")
		if csrfJar == nil {
			t.Fatalf("csrf_token missing in jar")
		}

		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/refresh", nil)
		req.Header.Set("X-CSRF-Token", csrfJar.Value)
		req.Header.Del("Origin")
		req.Header.Del("Referer")

		r3, err := client.Do(req)
		if err != nil {
			t.Fatalf("refresh request failed: %v", err)
		}
		r3.Body.Close()

		if r3.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 on refresh without Origin, got %d", r3.StatusCode)
		}
	}

	// -------------------------------
	// TEST 5 : Refresh OK + rotation
	// -------------------------------

	var refresh1, csrf1 string

	{
		c1 := getAuthCookie("refresh_token")
		if c1 == nil {
			t.Fatalf("refresh_token missing in jar before refresh")
		}
		refresh1 = c1.Value

		ccsrf := getRootCookie("csrf_token")
		if ccsrf == nil {
			t.Fatalf("csrf_token missing in jar before refresh")
		}
		csrf1 = ccsrf.Value

		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/refresh", nil)
		req.Header.Set("Origin", cfg.FrontendURL)
		req.Header.Set("X-CSRF-Token", csrf1)

		r4, err := client.Do(req)
		if err != nil {
			t.Fatalf("refresh request failed: %v", err)
		}
		r4.Body.Close()

		if r4.StatusCode != 200 {
			t.Fatalf("expected 200 on refresh with CSRF+Origin, got %d", r4.StatusCode)
		}
	}

	{
		c2 := getAuthCookie("refresh_token")
		if c2 == nil {
			t.Fatalf("refresh_token missing in jar after refresh")
		}
		if c2.Value == refresh1 {
			t.Fatalf("expected refresh_token rotation (different value), but got same token")
		}

		csrf2 := getRootCookie("csrf_token")
		if csrf2 == nil {
			t.Fatalf("csrf_token missing in jar after refresh")
		}
		if csrf2.Value == csrf1 {
			t.Fatalf("expected csrf_token rotation (different value), but got same token")
		}
	}

	// -------------------------------
	// TEST 6 : Logout OK
	// -------------------------------

	{
		csrfJar := getRootCookie("csrf_token")
		if csrfJar == nil {
			t.Fatalf("csrf_token missing in jar before logout")
		}

		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/logout", nil)
		req.Header.Set("Origin", cfg.FrontendURL)
		req.Header.Set("X-CSRF-Token", csrfJar.Value)

		r5, err := client.Do(req)
		if err != nil {
			t.Fatalf("logout request failed: %v", err)
		}
		r5.Body.Close()

		if r5.StatusCode != 200 {
			t.Fatalf("expected 200 on logout, got %d", r5.StatusCode)
		}

		ca := findCookie(r5.Cookies(), "access_token")
		cr := findCookie(r5.Cookies(), "refresh_token")
		cc := findCookie(r5.Cookies(), "csrf_token")

		if ca == nil || cr == nil || cc == nil {
			t.Fatalf("expected clear cookies on logout; got access=%v refresh=%v csrf=%v",
				ca != nil, cr != nil, cc != nil)
		}
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
