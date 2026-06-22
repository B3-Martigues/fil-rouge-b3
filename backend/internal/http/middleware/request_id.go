package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"
)

const RequestIDHeader = "X-Request-Id"

type requestIDKey string

const requestIDContextKey requestIDKey = "request_id"

func RequestID() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestID := requestIDFromHeader(r.Header.Get(RequestIDHeader))
			if requestID == "" {
				requestID = newRequestID()
			}

			w.Header().Set(RequestIDHeader, requestID)
			ctx := context.WithValue(r.Context(), requestIDContextKey, requestID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetRequestID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}

	value, _ := ctx.Value(requestIDContextKey).(string)
	return value
}

func requestIDFromHeader(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || len(trimmed) > 128 {
		return ""
	}

	for _, r := range trimmed {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= 'A' && r <= 'Z':
		case r >= '0' && r <= '9':
		case r == '-' || r == '_' || r == '.':
		default:
			return ""
		}
	}

	return trimmed
}

func newRequestID() string {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err == nil {
		return hex.EncodeToString(raw[:])
	}

	return strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "")
}
