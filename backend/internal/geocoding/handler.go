package geocoding

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"mappening/internal/httpx"
)

type Suggester interface {
	Suggest(ctx context.Context, query string, limit int) ([]Result, error)
}

type Handler struct {
	Suggester Suggester
}

func (h Handler) Suggest(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" {
		httpx.WriteJSON(w, http.StatusOK, []Result{})
		return
	}

	limit := 5
	if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil || parsedLimit < 0 {
			httpx.WriteJSONError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = parsedLimit
	}

	if h.Suggester == nil {
		httpx.WriteJSON(w, http.StatusOK, []Result{})
		return
	}

	suggestions, err := h.Suggester.Suggest(r.Context(), query, limit)
	if err != nil {
		log.Error().Err(err).Msg("address suggestions failed")
		httpx.WriteJSONError(w, http.StatusBadGateway, "address suggestion service unavailable")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, suggestions)
}

func RegisterRoutes(r chi.Router, handler Handler) {
	r.Get("/api/geocoding/suggestions", handler.Suggest)
}
