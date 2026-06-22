package middleware

import (
	"net/http"

	"mappening/internal/httpx"
)

func writeJSONError(w http.ResponseWriter, status int, message string) {
	httpx.WriteJSONError(w, status, message)
}
