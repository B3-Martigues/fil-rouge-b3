package staff

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"mappening/internal/http/middleware"
	"mappening/internal/httpx"
)

type Handler struct {
	Repo *Repository
}

func (h Handler) Snapshot(w http.ResponseWriter, r *http.Request) {
	snapshot, err := h.repo().Snapshot(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("staff snapshot failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, snapshot)
}

func (h Handler) ApplyAction(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUser(r)
	if claims == nil {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req ActionRequest
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	moderatorUserID, err := h.userProfileID(r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "authenticated profile not found")
		return
	}

	snapshot, err := h.repo().ApplyAction(r.Context(), req, moderatorUserID, claims.Role)
	if err != nil {
		writeStaffError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, snapshot)
}

func (h Handler) CreateReport(w http.ResponseWriter, r *http.Request) {
	authenticatedUserID, err := h.userProfileID(r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "authenticated profile not found")
		return
	}

	var req CreateReportRequest
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	report, err := h.repo().CreateReport(r.Context(), req, authenticatedUserID)
	if err != nil {
		writeStaffError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, report)
}

func (h Handler) userProfileID(r *http.Request) (int64, error) {
	claims := middleware.GetUser(r)
	if claims == nil || claims.UserID <= 0 {
		return 0, ErrForbidden
	}
	return h.repo().userProfileIDByAccountID(r.Context(), claims.UserID)
}

func (h Handler) repo() *Repository {
	return h.Repo
}

func (r *Repository) userProfileIDByAccountID(ctx context.Context, accountID int64) (int64, error) {
	var userID int64
	err := r.db.QueryRowContext(ctx, `
		SELECT id
		FROM users
		WHERE account_id = $1
		  AND deleted_at IS NULL
	`, accountID).Scan(&userID)
	if err != nil {
		return 0, err
	}
	return userID, nil
}

func writeStaffError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrForbidden):
		httpx.WriteJSONError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, ErrNotFound):
		httpx.WriteJSONError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrValidation), strings.Contains(err.Error(), "duplicate key"):
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
	default:
		log.Error().Err(err).Msg("staff handler failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
	}
}

func RegisterRoutes(r chi.Router, handler Handler, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(pr chi.Router) {
		pr.Use(authMiddleware)
		pr.Use(middleware.RequireRole("admin", "moderator"))
		pr.Get("/api/staff/snapshot", handler.Snapshot)
		pr.Post("/api/staff/actions", handler.ApplyAction)
	})

	r.Group(func(pr chi.Router) {
		pr.Use(authMiddleware)
		pr.Use(middleware.RequireRole("user"))
		pr.Post("/api/moderation/reports", handler.CreateReport)
	})
}
