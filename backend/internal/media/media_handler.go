package media

import (
	"errors"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"github.com/rs/zerolog/log"

	"mappening/internal/http/middleware"
	"mappening/internal/httpx"
)

type Handler struct {
	Service Service
}

func (h Handler) Upload(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}
	file, header, request, ok := h.parseUpload(w, r, "image")
	if !ok {
		return
	}
	defer file.Close()

	media, err := h.service().Upload(r.Context(), actor, request, file, header)
	if err != nil {
		writeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, responseFromMedia(media))
}

func (h Handler) Delete(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}
	mediaID, err := httpx.ParseIDParam(r, "mediaID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid media id")
		return
	}
	if err := h.service().Delete(r.Context(), actor, mediaID); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h Handler) ReplaceOrganizationLogo(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	file, header, _, ok := h.parseUpload(w, r, "image")
	if !ok {
		return
	}
	defer file.Close()

	media, err := h.service().ReplaceOrganizationLogo(r.Context(), actor, organizationID, file, header)
	if err != nil {
		writeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, responseFromMedia(media))
}

func (h Handler) ReplaceEventImage(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}
	eventID, err := httpx.ParseIDParam(r, "eventID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid event id")
		return
	}
	file, header, _, ok := h.parseUpload(w, r, "image")
	if !ok {
		return
	}
	defer file.Close()

	media, err := h.service().ReplaceEventImage(r.Context(), actor, eventID, file, header)
	if err != nil {
		writeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, responseFromMedia(media))
}

func (h Handler) parseUpload(w http.ResponseWriter, r *http.Request, field string) (multipart.File, *multipart.FileHeader, UploadRequest, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, MaxImageBytes+64<<10)
	if err := r.ParseMultipartForm(MaxImageBytes + 64<<10); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid image upload")
		return nil, nil, UploadRequest{}, false
	}

	file, header, err := r.FormFile(field)
	if err != nil && field != "file" {
		file, header, err = r.FormFile("file")
	}
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "image is required")
		return nil, nil, UploadRequest{}, false
	}

	request := UploadRequest{
		EntityType: strings.TrimSpace(r.FormValue("entity_type")),
	}
	if request.EntityType == "" {
		request.EntityType = strings.TrimSpace(r.FormValue("type"))
	}
	if id, ok := parseOptionalID(r.FormValue("entity_id")); ok {
		request.EntityID = &id
	}
	if id, ok := parseOptionalID(r.FormValue("organization_id")); ok {
		request.OrganizationID = &id
	}

	return file, header, request, true
}

func (h Handler) service() Service {
	return h.Service
}

func parseOptionalID(value string) (int64, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, false
	}
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func actorFromRequest(r *http.Request) (Actor, bool) {
	claims := middleware.GetUser(r)
	if claims == nil || claims.UserID <= 0 {
		return Actor{}, false
	}
	return Actor{AccountID: claims.UserID, Role: claims.Role}, true
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrForbidden):
		httpx.WriteJSONError(w, http.StatusForbidden, ErrForbidden.Error())
	case errors.Is(err, ErrMediaNotFound):
		httpx.WriteJSONError(w, http.StatusNotFound, ErrMediaNotFound.Error())
	case IsValidationError(err):
		httpx.WriteJSONError(w, http.StatusBadRequest, publicError(err))
	default:
		log.Error().Err(err).Msg("media handler failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
	}
}
