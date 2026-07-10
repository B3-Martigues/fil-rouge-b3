package staff

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"mappening/internal/events"
	"mappening/internal/http/middleware"
	"mappening/internal/httpx"
)

type Handler struct {
	Service Service
}

var reportAllowedRoles = []string{"user", "admin", "moderator"}

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

	if err := h.service().ApplyAction(r.Context(), req, moderatorUserID, claims.Role); err != nil {
		writeStaffError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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

	report, err := h.service().CreateReport(r.Context(), req, authenticatedUserID)
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
	return h.service().UserProfileIDByAccountID(r.Context(), claims.UserID)
}

func (h Handler) service() Service {
	return h.Service
}

func (h Handler) Summary(w http.ResponseWriter, r *http.Request) {
	writeStaffList(w, "load staff summary", func() (*Summary, error) {
		return h.service().Summary(r.Context(), parseStaffListOptions(r))
	})
}

func (h Handler) Accounts(w http.ResponseWriter, r *http.Request) {
	writeStaffList(w, "list staff accounts", func() ([]Account, error) {
		return h.service().Accounts(r.Context(), parseStaffListOptions(r))
	})
}

func (h Handler) Users(w http.ResponseWriter, r *http.Request) {
	writeStaffList(w, "list staff users", func() ([]User, error) {
		return h.service().Users(r.Context(), parseStaffListOptions(r))
	})
}

func (h Handler) Organizations(w http.ResponseWriter, r *http.Request) {
	writeStaffList(w, "list staff organizations", func() ([]Organization, error) {
		return h.service().Organizations(r.Context(), parseStaffListOptions(r))
	})
}

func (h Handler) Organizers(w http.ResponseWriter, r *http.Request) {
	writeStaffList(w, "list staff organizers", func() ([]Organizer, error) {
		return h.service().Organizers(r.Context(), parseStaffListOptions(r))
	})
}

func (h Handler) Events(w http.ResponseWriter, r *http.Request) {
	writeStaffList(w, "list staff events", func() ([]events.Event, error) {
		return h.service().Events(r.Context(), parseStaffListOptions(r))
	})
}

func (h Handler) NotificationTypes(w http.ResponseWriter, r *http.Request) {
	writeStaffList(w, "list staff notification types", func() ([]NotificationType, error) {
		return h.service().NotificationTypes(r.Context())
	})
}

func (h Handler) Notifications(w http.ResponseWriter, r *http.Request) {
	writeStaffList(w, "list staff notifications", func() ([]Notification, error) {
		return h.service().Notifications(r.Context(), parseStaffListOptions(r))
	})
}

func (h Handler) ModerationReports(w http.ResponseWriter, r *http.Request) {
	writeStaffList(w, "list staff moderation reports", func() ([]ModerationReport, error) {
		return h.service().ModerationReports(r.Context(), parseStaffListOptions(r))
	})
}

func (h Handler) ModerationDecisions(w http.ResponseWriter, r *http.Request) {
	writeStaffList(w, "list staff moderation decisions", func() ([]ModerationDecision, error) {
		return h.service().ModerationDecisions(r.Context(), parseStaffListOptions(r))
	})
}

func parseStaffListOptions(r *http.Request) ListOptions {
	query := r.URL.Query()
	options := ListOptions{
		Query:  strings.TrimSpace(query.Get("q")),
		Status: strings.TrimSpace(strings.ToLower(query.Get("status"))),
	}
	if claims := middleware.GetUser(r); claims != nil {
		options.Role = strings.TrimSpace(strings.ToLower(claims.Role))
	}
	return options
}

func writeStaffList[T any](w http.ResponseWriter, logMessage string, load func() (T, error)) {
	data, err := load()
	if err != nil {
		log.Error().Err(err).Msg(logMessage)
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, data)
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
		pr.Get("/api/staff/summary", handler.Summary)
		pr.Get("/api/staff/accounts", handler.Accounts)
		pr.Get("/api/staff/users", handler.Users)
		pr.Get("/api/staff/organizations", handler.Organizations)
		pr.Get("/api/staff/organizers", handler.Organizers)
		pr.Get("/api/staff/events", handler.Events)
		pr.Get("/api/staff/notification-types", handler.NotificationTypes)
		pr.Get("/api/staff/notifications", handler.Notifications)
		pr.Get("/api/staff/moderation-reports", handler.ModerationReports)
		pr.Get("/api/staff/moderation-decisions", handler.ModerationDecisions)
		pr.Post("/api/staff/actions", handler.ApplyAction)
	})

	r.Group(func(pr chi.Router) {
		pr.Use(authMiddleware)
		pr.Use(middleware.RequireRole(reportAllowedRoles...))
		pr.Post("/api/moderation/reports", handler.CreateReport)
	})
}
