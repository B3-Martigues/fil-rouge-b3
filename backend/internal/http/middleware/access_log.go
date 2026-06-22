package middleware

import (
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

type loggingResponseWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *loggingResponseWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *loggingResponseWriter) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}

	n, err := w.ResponseWriter.Write(p)
	w.bytes += n
	return n, err
}

func AccessLog(trustedProxyCIDRs ...string) func(http.Handler) http.Handler {
	trustedProxyRanges := parseTrustedProxyRanges(trustedProxyCIDRs)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			startedAt := time.Now()
			lrw := &loggingResponseWriter{ResponseWriter: w}

			next.ServeHTTP(lrw, r)

			status := lrw.status
			if status == 0 {
				status = http.StatusOK
			}

			event := log.Info()
			switch {
			case status >= http.StatusInternalServerError:
				event = log.Error()
			case status >= http.StatusBadRequest:
				event = log.Warn()
			}

			event.
				Str("request_id", GetRequestID(r.Context())).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("remote_ip", clientIP(r, trustedProxyRanges)).
				Int("status", status).
				Int("bytes", lrw.bytes).
				Dur("duration", time.Since(startedAt)).
				Msg("http request")
		})
	}
}
