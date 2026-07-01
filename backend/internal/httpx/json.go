package httpx

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// Ecrit une reponse JSON avec le code HTTP attendu.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Ecrit une erreur JSON au format standard de l'API.
func WriteJSONError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]string{
		"error": message,
	})
}

// Decode un JSON en refusant les champs inconnus et les corps trop volumineux.
func DecodeStrictJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	const maxJSONBodyBytes = 1 << 20

	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodyBytes)

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

if err := decoder.Decode(dst); err != nil {
    return fmt.Errorf("invalid json body: %w", err)
}

	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return fmt.Errorf("invalid json body")
	}

	return nil
}
