package middleware

import (
	"net/http"
	"net/netip"
	"strings"
)

// Applique un ensemble de headers defensifs sur toutes les reponses HTTP.
func SecurityHeaders(trustedProxyCIDRs ...string) func(http.Handler) http.Handler {
	trustedProxyRanges := parseTrustedProxyRanges(trustedProxyCIDRs)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "no-referrer")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
			w.Header().Set("X-Permitted-Cross-Domain-Policies", "none")
			w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
			w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
			w.Header().Set("Origin-Agent-Cluster", "?1")
			w.Header().Set("X-DNS-Prefetch-Control", "off")
			if isHTTPSRequest(r, trustedProxyRanges) {
				w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Determine si la requete doit etre consideree comme HTTPS, meme derriere un proxy de confiance.
func isHTTPSRequest(r *http.Request, trustedProxyRanges []netip.Prefix) bool {
	if r.TLS != nil {
		return true
	}

	remoteIP, _ := remoteRequestIP(r.RemoteAddr)
	if remoteIP == "" || !isTrustedProxy(remoteIP, trustedProxyRanges) {
		return false
	}

	return strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https")
}
