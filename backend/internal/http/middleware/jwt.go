package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"mappening/internal/httpx"
	"mappening/internal/users"
)

type ctxKey string

const userKey ctxKey = "user"

type UserClaims struct {
	UserID          int64  `json:"user_id"`
	Email           string `json:"email"`
	Role            string `json:"role"`
	SessionRevision int64  `json:"session_revision,omitempty"`
	jwt.RegisteredClaims
}

// Construit le middleware JWT standard sans verification de l'etat utilisateur en base.
func AuthJWT(secret string, issuer string, env string) func(http.Handler) http.Handler {
	return AuthJWTWithUserLookup(secret, issuer, env, nil)
}

type authUserStateReader interface {
	GetByEmail(ctx context.Context, email string) (*users.User, error)
}

// Construit le middleware JWT avec verification optionnelle du compte courant en base.
func AuthJWTWithUserLookup(
	secret string,
	issuer string,
	env string,
	userRepo authUserStateReader,
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var tokenStr string
			var err error

			if allowsBearerFallback(env) {
				tokenStr, err = tokenFromRequest(r)
			} else {
				tokenStr, err = cookieToken(r)
			}

			if err != nil {
				writeJSONError(w, http.StatusUnauthorized, "missing token")
				return
			}

			claims := &UserClaims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
				if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
					return nil, errors.New("unexpected signing method")
				}
				return []byte(secret), nil
			})

			if err != nil || !token.Valid {
				writeJSONError(w, http.StatusUnauthorized, "invalid token")
				return
			}

			if !isAccessTokenClaims(claims, issuer) {
				writeJSONError(w, http.StatusUnauthorized, "invalid token")
				return
			}

			if !hasCurrentUserState(r.Context(), userRepo, claims) {
				writeJSONError(w, http.StatusUnauthorized, "invalid token")
				return
			}

			ctx := context.WithValue(r.Context(), userKey, claims)
			ctx = httpx.WithCurrentUserID(ctx, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Verifie qu'un token correspond bien a un access token valide pour cette API.
func isAccessTokenClaims(claims *UserClaims, issuer string) bool {
	if claims == nil || claims.Subject == "" {
		return false
	}

	if issuer != "" && claims.Issuer != issuer {
		return false
	}

	if hasAudience(claims.Audience, "refresh") {
		return false
	}

	if len(claims.Audience) > 0 && !hasAudience(claims.Audience, "access") {
		return false
	}

	return true
}

// Verifie la presence d'une audience specifique dans les claims JWT.
func hasAudience(audiences []string, expected string) bool {
	for _, audience := range audiences {
		if audience == expected {
			return true
		}
	}

	return false
}

// Confirme que les claims correspondent encore a l'etat actuel du compte.
func hasCurrentUserState(ctx context.Context, userRepo authUserStateReader, claims *UserClaims) bool {
	if userRepo == nil {
		return true
	}
	if claims == nil {
		return false
	}

	subject := strings.TrimSpace(strings.ToLower(claims.Subject))
	if subject == "" {
		return false
	}

	user, err := userRepo.GetByEmail(ctx, subject)
	if err != nil || user == nil {
		return false
	}
	if !user.IsActive {
		return false
	}
	if user.ID != claims.UserID {
		return false
	}
	if !strings.EqualFold(user.Email, claims.Subject) {
		return false
	}
	if user.Role != claims.Role {
		return false
	}

	return matchesSessionRevision(user.UpdatedAt, claims)
}

// Compare la revision de session du token avec celle derivee du compte courant.
func matchesSessionRevision(updatedAt time.Time, claims *UserClaims) bool {
	currentRevision := sessionRevision(updatedAt)
	if currentRevision == 0 {
		return true
	}
	if claims == nil {
		return false
	}
	if claims.SessionRevision != 0 {
		return claims.SessionRevision == currentRevision
	}
	if claims.IssuedAt == nil || claims.IssuedAt.Time.IsZero() {
		return false
	}

	const legacyGraceWindow = 5 * time.Second
	return !updatedAt.UTC().After(claims.IssuedAt.Time.UTC().Add(legacyGraceWindow))
}

// Derive une revision monotone de session a partir de la date de mise a jour du compte.
func sessionRevision(updatedAt time.Time) int64 {
	if updatedAt.IsZero() {
		return 0
	}

	return updatedAt.UTC().UnixMicro()
}

// Autorise en dev la lecture du token depuis Bearer pour simplifier les tests locaux.
func allowsBearerFallback(env string) bool {
	switch normalizeEnv(env) {
	case "dev", "development", "test", "local":
		return true
	default:
		return false
	}
}

// Normalise le nom d'environnement pour les checks middleware.
func normalizeEnv(env string) string {
	return strings.ToLower(strings.TrimSpace(env))
}

// Extrait les claims utilisateur du contexte HTTP.
func GetUser(r *http.Request) *UserClaims {
	v := r.Context().Value(userKey)
	if v == nil {
		return nil
	}
	uc, _ := v.(*UserClaims)
	return uc
}

// Tente de lire le token depuis le cookie puis depuis Authorization en environnement local.
func tokenFromRequest(r *http.Request) (string, error) {
	if c, err := r.Cookie("access_token"); err == nil && c.Value != "" {
		return c.Value, nil
	}
	return bearerToken(r)
}

// Lit uniquement le token stocke en cookie HTTP.
func cookieToken(r *http.Request) (string, error) {
	c, err := r.Cookie("access_token")
	if err != nil || c.Value == "" {
		return "", errors.New("no cookie token")
	}
	return c.Value, nil
}

// Parse un header Authorization de type Bearer.
func bearerToken(r *http.Request) (string, error) {
	h := r.Header.Get("Authorization")
	if h == "" {
		return "", errors.New("no auth header")
	}
	parts := strings.SplitN(h, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", errors.New("bad auth header")
	}
	if parts[1] == "" {
		return "", errors.New("empty token")
	}
	return parts[1], nil
}
