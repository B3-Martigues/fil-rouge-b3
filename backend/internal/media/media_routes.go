package media

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, handler Handler, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(pr chi.Router) {
		pr.Use(authMiddleware)

		pr.Post("/api/media/upload", handler.Upload)
		pr.Delete("/api/media/{mediaID}", handler.Delete)
		pr.Post("/api/organizations/{organizationID}/logo", handler.ReplaceOrganizationLogo)
		pr.Post("/api/events/{eventID}/image", handler.ReplaceEventImage)

		// Backward-compatible endpoint used by older clients.
		pr.Post("/api/events/images", handler.Upload)
	})
}
