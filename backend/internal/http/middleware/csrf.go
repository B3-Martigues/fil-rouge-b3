package middleware

import (
	"crypto/subtle"
	"net/http"
	"net/url"
	"strings"
)

type CsrfOptions struct {
	CookieName   string
	HeaderName   string
	SkipPaths    []string
	SkipPrefixes []string
	FrontendURL  string
}

// Protege les requetes mutantes via un controle combine Origin/Referer + token CSRF.
func CsrfProtect(opts CsrfOptions) func(http.Handler) http.Handler {
	if opts.CookieName == "" {
		opts.CookieName = "csrf_token"
	}
	if opts.HeaderName == "" {
		opts.HeaderName = "X-CSRF-Token"
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			for _, path := range opts.SkipPaths {
				if r.URL.Path == path {
					next.ServeHTTP(w, r)
					return
				}
			}

			for _, prefix := range opts.SkipPrefixes {
				if strings.HasPrefix(r.URL.Path, prefix) {
					next.ServeHTTP(w, r)
					return
				}
			}

			// Uniquement pour méthodes mutantes
			if r.Method == http.MethodPost ||
				r.Method == http.MethodPut ||
				r.Method == http.MethodPatch ||
				r.Method == http.MethodDelete {

				// 🔒 ORIGIN CHECK
				origin := r.Header.Get("Origin")
				referer := r.Header.Get("Referer")

				if origin != "" {
					if !sameOrigin(origin, opts.FrontendURL) {
						writeJSONError(w, http.StatusForbidden, "invalid origin")
						return
					}
				} else if referer != "" {
					if !sameOrigin(referer, opts.FrontendURL) {
						writeJSONError(w, http.StatusForbidden, "invalid referer")
						return
					}
				} else {
					writeJSONError(w, http.StatusForbidden, "missing origin")
					return
				}

				// 🔒 CSRF TOKEN CHECK
				cookie, err := r.Cookie(opts.CookieName)
				if err != nil {
					writeJSONError(w, http.StatusForbidden, "missing csrf cookie")
					return
				}

				headerToken := r.Header.Get(opts.HeaderName)
				if headerToken == "" {
					writeJSONError(w, http.StatusForbidden, "missing csrf header")
					return
				}

				if subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(headerToken)) != 1 {
					writeJSONError(w, http.StatusForbidden, "csrf mismatch")
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Compare deux origines completes a partir de leur schema et de leur host.
func sameOrigin(candidate string, allowed string) bool {
	candidateURL, err := url.Parse(strings.TrimSpace(candidate))
	if err != nil || !candidateURL.IsAbs() {
		return false
	}

	allowedURL, err := url.Parse(strings.TrimSpace(allowed))
	if err != nil || !allowedURL.IsAbs() {
		return false
	}

	return strings.EqualFold(candidateURL.Scheme, allowedURL.Scheme) &&
		strings.EqualFold(candidateURL.Host, allowedURL.Host)
}
