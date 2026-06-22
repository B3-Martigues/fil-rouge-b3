package auth

import (
	"net/http"
	"time"
)

type CookieOpts struct {
	Secure           bool
	CSRFCookieDomain string
}

func setAuthCookies(w http.ResponseWriter, accessToken string, accessExp time.Time, refreshToken string, refreshExp time.Time, opts CookieOpts) {
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   opts.Secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   cookieMaxAge(accessExp),
		Expires:  accessExp,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   opts.Secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   cookieMaxAge(refreshExp),
		Expires:  refreshExp,
	})
}

// CSRF cookie non-HttpOnly pour que le front puisse le lire et le renvoyer en header
func setCsrfCookie(w http.ResponseWriter, csrf string, exp time.Time, opts CookieOpts) {
	http.SetCookie(w, &http.Cookie{
		Name:     "csrf_token",
		Value:    csrf,
		Domain:   opts.CSRFCookieDomain,
		Path:     "/",
		HttpOnly: false,
		Secure:   opts.Secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   cookieMaxAge(exp),
		Expires:  exp,
	})
}

func clearAuthCookies(w http.ResponseWriter, opts CookieOpts) {
	expiredAt := time.Unix(0, 0).UTC()

	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   opts.Secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  expiredAt,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   opts.Secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  expiredAt,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     "csrf_token",
		Value:    "",
		Domain:   opts.CSRFCookieDomain,
		Path:     "/",
		HttpOnly: false,
		Secure:   opts.Secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  expiredAt,
	})

	if opts.CSRFCookieDomain != "" {
		http.SetCookie(w, &http.Cookie{
			Name:     "csrf_token",
			Value:    "",
			Path:     "/",
			HttpOnly: false,
			Secure:   opts.Secure,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
			Expires:  expiredAt,
		})
	}
}

func cookieMaxAge(exp time.Time) int {
	if exp.IsZero() {
		return 0
	}

	maxAge := int(time.Until(exp).Seconds())
	if maxAge < 1 {
		return 1
	}

	return maxAge
}
