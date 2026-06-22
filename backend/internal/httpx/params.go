package httpx

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

type currentUserIDContextKey struct{}

var userIDContextKey currentUserIDContextKey

// Parse un identifiant de route Chi et verifie qu'il est positif.
func ParseIDParam(r *http.Request, name string) (int64, error) {
	raw := chi.URLParam(r, name)
	if raw == "" {
		return 0, errors.New("missing param")
	}

	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid id")
	}

	return id, nil
}

// Retourne nil quand une chaine de formulaire est vide apres trim.
func NullableTrimmedString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}

// Lit un champ texte optionnel depuis un formulaire.
func ParseOptionalStringFormValue(r *http.Request, field string) *string {
	return NullableTrimmedString(r.FormValue(field))
}

// Lit un booleen optionnel depuis un formulaire avec une valeur par defaut.
func ParseOptionalBoolFormValue(r *http.Request, field string, defaultValue bool) (bool, error) {
	raw := strings.TrimSpace(r.FormValue(field))
	if raw == "" {
		return defaultValue, nil
	}

	value, err := strconv.ParseBool(raw)
	if err != nil {
		return false, errors.New("invalid bool form value")
	}

	return value, nil
}

// Parse un entier optionnel depuis un formulaire multipart ou x-www-form-urlencoded.
func ParseOptionalInt64FormValue(r *http.Request, field string) (*int64, error) {
	raw := strings.TrimSpace(r.FormValue(field))
	if raw == "" {
		return nil, nil
	}

	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		return nil, errors.New("invalid int64 form value")
	}

	return &value, nil
}

// Parse un entier obligatoire depuis un formulaire.
func ParseInt64FormValue(r *http.Request, field string) (int64, error) {
	raw := strings.TrimSpace(r.FormValue(field))
	if raw == "" {
		return 0, errors.New("missing form value")
	}

	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		return 0, errors.New("invalid int64 form value")
	}

	return value, nil
}

// Stocke l'identifiant utilisateur authentifie sous une cle de contexte typée.
func WithCurrentUserID(ctx context.Context, userID int64) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}

	return context.WithValue(ctx, userIDContextKey, userID)
}

// Tente d'extraire l'identifiant utilisateur depuis la cle de contexte typée.
func CurrentUserIDFromContext(ctx context.Context) (int64, error) {
	if ctx == nil {
		return 0, errors.New("user id not found in context")
	}

	value, _ := ctx.Value(userIDContextKey).(int64)
	if value <= 0 {
		return 0, errors.New("user id not found in context")
	}

	return value, nil
}
