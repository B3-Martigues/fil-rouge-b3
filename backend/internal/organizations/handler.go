package organizations

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"mappening/internal/http/middleware"
	"mappening/internal/httpx"
)

type Handler struct {
	Service Service
}

func (h Handler) List(w http.ResponseWriter, r *http.Request) {
	organizations, err := h.service().ListPublic(r.Context(), ListFilters{
		Query: strings.TrimSpace(r.URL.Query().Get("q")),
	})
	if err != nil {
		log.Error().Err(err).Msg("list organizations failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, organizations)
}

func (h Handler) Get(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}

	organization, err := h.service().GetPublic(r.Context(), organizationID)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, organization)
}

func (h Handler) Me(w http.ResponseWriter, r *http.Request) {
	accountID, _, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	organization, err := h.service().GetMine(r.Context(), accountID)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, organization)
}

func (h Handler) Mine(w http.ResponseWriter, r *http.Request) {
	accountID, _, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	organizations, err := h.service().ListMine(r.Context(), accountID)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, organizations)
}

func (h Handler) ListByUser(w http.ResponseWriter, r *http.Request) {
	userID, err := httpx.ParseIDParam(r, "userID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	organizations, err := h.service().ListByUser(r.Context(), userID, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, organizations)
}

func (h Handler) Create(w http.ResponseWriter, r *http.Request) {
	input, err := decodeAndValidateOrganizationInput(w, r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	organization, err := h.service().Create(r.Context(), input, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, organization)
}

func (h Handler) Update(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	input, err := decodeAndValidateOrganizationInput(w, r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	organization, err := h.service().Update(r.Context(), organizationID, input, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, organization)
}

func (h Handler) SetStatus(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	var req StatusInput
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	_, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	organization, err := h.service().SetActive(r.Context(), organizationID, req.IsActive, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, organization)
}

func (h Handler) SetVerification(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	var req VerificationInput
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	_, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	organization, err := h.service().SetVerified(r.Context(), organizationID, req.IsVerified, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, organization)
}

func (h Handler) Delete(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	if err := h.service().Delete(r.Context(), organizationID, accountID, role); err != nil {
		writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h Handler) Restore(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	_, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	organization, err := h.service().Restore(r.Context(), organizationID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, organization)
}

func (h Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.service().ListCategories(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("list organization categories failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, categories)
}

func (h Handler) ReplaceCategories(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	var req struct {
		CategoryIDs   []int64  `json:"category_ids"`
		CategorySlugs []string `json:"category_slugs"`
	}
	if err := httpx.DecodeStrictJSON(w, r, &req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	organization, err := h.service().ReplaceCategories(r.Context(), organizationID, req.CategoryIDs, normalizeSlugs(req.CategorySlugs), accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, organization)
}

func (h Handler) ClearCategories(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	organization, err := h.service().ClearCategories(r.Context(), organizationID, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, organization)
}

func (h Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	members, err := h.service().ListMembers(r.Context(), organizationID, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, members)
}

func (h Handler) AddMember(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	var input MemberInput
	if err := httpx.DecodeStrictJSON(w, r, &input); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	if input.UserID <= 0 {
		httpx.WriteJSONError(w, http.StatusBadRequest, "user_id is required")
		return
	}
	if input.JobRole != nil {
		jobRole := strings.TrimSpace(*input.JobRole)
		if utf8.RuneCountInString(jobRole) > 50 {
			httpx.WriteJSONError(w, http.StatusBadRequest, "job_role is too long")
			return
		}
		input.JobRole = &jobRole
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	member, err := h.service().AddMember(r.Context(), organizationID, input, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, member)
}

func (h Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	userID, err := httpx.ParseIDParam(r, "userID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	if err := h.service().RemoveMember(r.Context(), organizationID, userID, accountID, role); err != nil {
		writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h Handler) service() Service {
	return h.Service
}

func decodeAndValidateOrganizationInput(w http.ResponseWriter, r *http.Request) (OrganizationInput, error) {
	var input OrganizationInput
	if err := httpx.DecodeStrictJSON(w, r, &input); err != nil {
		return input, err
	}

	input.Name = strings.TrimSpace(input.Name)
	input.ContactEmail = strings.TrimSpace(strings.ToLower(input.ContactEmail))
	input.Address = strings.TrimSpace(input.Address)
	input.City = strings.TrimSpace(input.City)
	input.PostalCode = strings.TrimSpace(input.PostalCode)
	input.Description = trimmedOptional(input.Description)
	input.Website = trimmedOptional(input.Website)
	input.Logo = trimmedOptional(input.Logo)
	input.ContactPhoneNumber = trimmedOptional(input.ContactPhoneNumber)
	input.SIRET = trimmedOptional(input.SIRET)
	input.CategorySlugs = normalizeSlugs(input.CategorySlugs)

	if input.Name == "" {
		return input, errors.New("name is required")
	}
	if utf8.RuneCountInString(input.Name) > 90 {
		return input, errors.New("name is too long")
	}
	if err := validateEmail(input.ContactEmail); err != nil {
		return input, err
	}
	if input.Address == "" {
		return input, errors.New("address is required")
	}
	if input.City == "" {
		return input, errors.New("city is required")
	}
	if utf8.RuneCountInString(input.City) > 50 {
		return input, errors.New("city is too long")
	}
	if input.PostalCode == "" {
		return input, errors.New("postal_code is required")
	}
	if utf8.RuneCountInString(input.PostalCode) > 10 {
		return input, errors.New("postal_code is too long")
	}
	if input.SIRET != nil && utf8.RuneCountInString(*input.SIRET) > 50 {
		return input, errors.New("siret is too long")
	}
	if input.Latitude != nil && (*input.Latitude < -90 || *input.Latitude > 90) {
		return input, errors.New("latitude must be between -90 and 90")
	}
	if input.Longitude != nil && (*input.Longitude < -180 || *input.Longitude > 180) {
		return input, errors.New("longitude must be between -180 and 180")
	}
	for _, value := range []struct {
		name  string
		field *string
		max   int
	}{
		{"website", input.Website, 255},
		{"logo", input.Logo, 255},
		{"contact_phone_number", input.ContactPhoneNumber, 20},
	} {
		if value.field != nil && utf8.RuneCountInString(*value.field) > value.max {
			return input, errors.New(value.name + " is too long")
		}
	}
	if input.Description != nil {
		for _, r := range *input.Description {
			if unicode.IsControl(r) && r != '\n' && r != '\t' && r != '\r' {
				return input, errors.New("description cannot contain control characters")
			}
		}
	}

	return input, nil
}

func trimmedOptional(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeSlugs(values []string) []string {
	out := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.TrimSpace(strings.ToLower(value))
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func validateEmail(email string) error {
	const maxEmailLength = 254
	if email == "" {
		return errors.New("contact_email is required")
	}
	if len(email) > maxEmailLength || strings.ContainsAny(email, " \t\r\n") {
		return errors.New("contact_email is invalid")
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email {
		return errors.New("contact_email is invalid")
	}
	return nil
}

func authContext(r *http.Request) (int64, string, bool) {
	claims := middleware.GetUser(r)
	if claims == nil || claims.UserID <= 0 {
		return 0, "", false
	}
	return claims.UserID, claims.Role, true
}

func writeDomainError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrOrganizationNotFound),
		errors.Is(err, ErrCategoryNotFound),
		errors.Is(err, ErrOrganizerNotFound),
		errors.Is(err, ErrAccountNotFound),
		errors.Is(err, ErrUserNotFound):
		httpx.WriteJSONError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrForbidden):
		httpx.WriteJSONError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, ErrAccountRequired),
		errors.Is(err, ErrContactEmailUsed),
		errors.Is(err, ErrAccountAlreadyUsed),
		errors.Is(err, ErrSIRETAlreadyUsed):
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
	default:
		log.Error().Err(err).Msg("organizations handler failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
	}
}

func RegisterRoutes(r chi.Router, handler Handler, authMiddleware func(http.Handler) http.Handler) {
	r.Get("/api/organizations", handler.List)
	r.Get("/api/organizations/{organizationID}", handler.Get)
	r.Get("/api/organization-categories", handler.ListCategories)

	r.Group(func(pr chi.Router) {
		pr.Use(authMiddleware)

		pr.Get("/api/organizations/me", handler.Me)
		pr.Get("/api/me/organizations", handler.Mine)
		pr.Get("/api/users/{userID}/organizations", handler.ListByUser)
		pr.Post("/api/organizations", handler.Create)
		pr.Put("/api/organizations/{organizationID}", handler.Update)
		pr.Patch("/api/organizations/{organizationID}", handler.Update)
		pr.Patch("/api/organizations/{organizationID}/status", handler.SetStatus)
		pr.Patch("/api/organizations/{organizationID}/active", handler.SetStatus)
		pr.Patch("/api/organizations/{organizationID}/verification", handler.SetVerification)
		pr.Delete("/api/organizations/{organizationID}", handler.Delete)
		pr.Post("/api/organizations/{organizationID}/restore", handler.Restore)
		pr.Put("/api/organizations/{organizationID}/categories", handler.ReplaceCategories)
		pr.Delete("/api/organizations/{organizationID}/categories", handler.ClearCategories)
		pr.Get("/api/organizations/{organizationID}/members", handler.ListMembers)
		pr.Post("/api/organizations/{organizationID}/members", handler.AddMember)
		pr.Delete("/api/organizations/{organizationID}/members/{userID}", handler.RemoveMember)
	})
}
