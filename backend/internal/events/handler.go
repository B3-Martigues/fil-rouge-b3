package events

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"mappening/internal/geocoding"
	"mappening/internal/http/middleware"
	"mappening/internal/httpx"
)

type Handler struct {
	Repo     *Repository
	Geocoder geocoding.Normalizer
}

func (h Handler) List(w http.ResponseWriter, r *http.Request) {
	filters, err := parseListFilters(r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	events, err := h.repo().List(r.Context(), filters)
	if err != nil {
		log.Error().Err(err).Msg("list events failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, events)
}

func (h Handler) ListUpcoming(w http.ResponseWriter, r *http.Request) {
	filters, err := parseListFilters(r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	filters.UpcomingOnly = true
	events, err := h.repo().List(r.Context(), filters)
	if err != nil {
		log.Error().Err(err).Msg("list upcoming events failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, events)
}

func (h Handler) ListPast(w http.ResponseWriter, r *http.Request) {
	filters, err := parseListFilters(r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	filters.PastOnly = true
	events, err := h.repo().List(r.Context(), filters)
	if err != nil {
		log.Error().Err(err).Msg("list past events failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, events)
}

func (h Handler) ListPopular(w http.ResponseWriter, r *http.Request) {
	filters, err := parseListFilters(r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	filters.Sort = "popular"
	events, err := h.repo().List(r.Context(), filters)
	if err != nil {
		log.Error().Err(err).Msg("list popular events failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, events)
}

func (h Handler) ListByOrganization(w http.ResponseWriter, r *http.Request) {
	organizationID, err := httpx.ParseIDParam(r, "organizationID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	filters, err := parseListFilters(r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	filters.OrganizationID = &organizationID
	events, err := h.repo().List(r.Context(), filters)
	if err != nil {
		log.Error().Err(err).Int64("organization_id", organizationID).Msg("list organization events failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, events)
}

func (h Handler) Get(w http.ResponseWriter, r *http.Request) {
	eventID, err := httpx.ParseIDParam(r, "eventID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid event id")
		return
	}

	event, err := h.repo().GetByID(r.Context(), eventID, false)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, event)
}

func (h Handler) Create(w http.ResponseWriter, r *http.Request) {
	input, err := decodeAndValidateInput(w, r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.normalizeAddress(r, &input); err != nil {
		writeGeocodingError(w, err)
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	event, err := h.repo().Create(r.Context(), input, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, event)
}

func (h Handler) Update(w http.ResponseWriter, r *http.Request) {
	eventID, err := httpx.ParseIDParam(r, "eventID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid event id")
		return
	}
	input, err := decodeAndValidateInput(w, r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.normalizeAddress(r, &input); err != nil {
		writeGeocodingError(w, err)
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	event, err := h.repo().Update(r.Context(), eventID, input, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, event)
}

func (h Handler) Delete(w http.ResponseWriter, r *http.Request) {
	eventID, err := httpx.ParseIDParam(r, "eventID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid event id")
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	if err := h.repo().Delete(r.Context(), eventID, accountID, role); err != nil {
		writeDomainError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h Handler) SetActive(w http.ResponseWriter, r *http.Request) {
	eventID, err := httpx.ParseIDParam(r, "eventID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid event id")
		return
	}
	var req struct {
		IsActive bool `json:"is_active"`
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

	event, err := h.repo().SetActive(r.Context(), eventID, req.IsActive, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, event)
}

func (h Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.repo().ListCategories(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("list event categories failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, categories)
}

func (h Handler) GetCategory(w http.ResponseWriter, r *http.Request) {
	categoryID, err := httpx.ParseIDParam(r, "categoryID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid category id")
		return
	}
	category, err := h.repo().GetCategory(r.Context(), categoryID)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, category)
}

func (h Handler) ListByCategory(w http.ResponseWriter, r *http.Request) {
	categoryID, err := httpx.ParseIDParam(r, "categoryID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid category id")
		return
	}
	category, err := h.repo().GetCategory(r.Context(), categoryID)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	filters, err := parseListFilters(r)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	filters.CategorySlugs = append(filters.CategorySlugs, category.Slug)
	events, err := h.repo().List(r.Context(), filters)
	if err != nil {
		log.Error().Err(err).Int64("category_id", categoryID).Msg("list category events failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, events)
}

func (h Handler) ReplaceCategories(w http.ResponseWriter, r *http.Request) {
	eventID, err := httpx.ParseIDParam(r, "eventID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid event id")
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

	event, err := h.repo().ReplaceCategories(r.Context(), eventID, req.CategoryIDs, req.CategorySlugs, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, event)
}

func (h Handler) AddCategory(w http.ResponseWriter, r *http.Request) {
	eventID, categoryID, ok := routeEventAndCategoryIDs(w, r)
	if !ok {
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	event, err := h.repo().AddCategory(r.Context(), eventID, categoryID, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, event)
}

func (h Handler) RemoveCategory(w http.ResponseWriter, r *http.Request) {
	eventID, categoryID, ok := routeEventAndCategoryIDs(w, r)
	if !ok {
		return
	}
	accountID, role, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	event, err := h.repo().RemoveCategory(r.Context(), eventID, categoryID, accountID, role)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, event)
}

func (h Handler) AddFavorite(w http.ResponseWriter, r *http.Request) {
	eventID, err := httpx.ParseIDParam(r, "eventID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid event id")
		return
	}
	accountID, _, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	favorite, err := h.repo().AddFavorite(r.Context(), accountID, eventID)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, favorite)
}

func (h Handler) RemoveFavorite(w http.ResponseWriter, r *http.Request) {
	eventID, err := httpx.ParseIDParam(r, "eventID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid event id")
		return
	}
	accountID, _, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	if err := h.repo().RemoveFavorite(r.Context(), accountID, eventID); err != nil {
		writeDomainError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h Handler) IsFavorite(w http.ResponseWriter, r *http.Request) {
	eventID, err := httpx.ParseIDParam(r, "eventID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid event id")
		return
	}
	accountID, _, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	active, err := h.repo().IsFavorite(r.Context(), accountID, eventID)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]bool{"is_favorite": active})
}

func (h Handler) ListFavorites(w http.ResponseWriter, r *http.Request) {
	accountID, _, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	favorites, err := h.repo().ListFavorites(r.Context(), accountID)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, favorites)
}

func (h Handler) RecordHistory(w http.ResponseWriter, r *http.Request) {
	eventID, err := httpx.ParseIDParam(r, "eventID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid event id")
		return
	}
	accountID, _, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	history, err := h.repo().RecordHistory(r.Context(), accountID, eventID)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, history)
}

func (h Handler) ListHistory(w http.ResponseWriter, r *http.Request) {
	accountID, _, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	histories, err := h.repo().ListHistory(r.Context(), accountID)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, histories)
}

func (h Handler) RemoveHistory(w http.ResponseWriter, r *http.Request) {
	historyID, err := httpx.ParseIDParam(r, "historyID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid history id")
		return
	}
	accountID, _, ok := authContext(r)
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	if err := h.repo().RemoveHistory(r.Context(), accountID, historyID); err != nil {
		writeDomainError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h Handler) repo() *Repository {
	return h.Repo
}

func (h Handler) normalizeAddress(r *http.Request, input *EventInput) error {
	if h.Geocoder == nil {
		return nil
	}
	normalized, err := h.Geocoder.Normalize(r.Context(), geocoding.Address{
		Street:     input.Address,
		City:       input.City,
		PostalCode: input.PostalCode,
	})
	if err != nil {
		return err
	}

	input.Address = normalized.Address
	input.City = normalized.City
	input.PostalCode = normalized.PostalCode
	input.Latitude = &normalized.Latitude
	input.Longitude = &normalized.Longitude
	return nil
}

func decodeAndValidateInput(w http.ResponseWriter, r *http.Request) (EventInput, error) {
	var input EventInput
	if err := httpx.DecodeStrictJSON(w, r, &input); err != nil {
		return input, err
	}

	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.Address = strings.TrimSpace(input.Address)
	input.City = strings.TrimSpace(input.City)
	input.PostalCode = strings.TrimSpace(input.PostalCode)
	input.Image = strings.TrimSpace(input.Image)
	input.TicketingLink = strings.TrimSpace(input.TicketingLink)
	if input.Source != nil {
		source := strings.TrimSpace(*input.Source)
		input.Source = &source
	}

	if input.OrganizationID <= 0 {
		return input, errors.New("organization_id is required")
	}
	if input.Title == "" {
		return input, errors.New("title is required")
	}
	if input.Description == "" {
		return input, errors.New("description is required")
	}
	if input.Address == "" {
		return input, errors.New("address is required")
	}
	if input.City == "" {
		return input, errors.New("city is required")
	}
	if input.PostalCode == "" {
		return input, errors.New("postal_code is required")
	}
	if input.Image == "" {
		return input, errors.New("image is required")
	}
	if input.Price < 0 {
		return input, errors.New("price must be greater than or equal to 0")
	}
	if input.Latitude != nil && (*input.Latitude < -90 || *input.Latitude > 90) {
		return input, errors.New("latitude must be between -90 and 90")
	}
	if input.Longitude != nil && (*input.Longitude < -180 || *input.Longitude > 180) {
		return input, errors.New("longitude must be between -180 and 180")
	}
	if len(input.CategoryIDs) == 0 && len(input.CategorySlugs) == 0 {
		return input, errors.New("at least one event category is required")
	}

	startDate, err := parseRequiredTime(input.StartDate, "start_date")
	if err != nil {
		return input, err
	}
	endDate, err := parseRequiredTime(input.EndDate, "end_date")
	if err != nil {
		return input, err
	}
	if endDate.Before(startDate) {
		return input, errors.New("end_date must be after or equal to start_date")
	}

	input.StartDate = startDate.Format(time.RFC3339)
	input.EndDate = endDate.Format(time.RFC3339)

	return input, nil
}

func parseListFilters(r *http.Request) (ListFilters, error) {
	query := r.URL.Query()
	filters := ListFilters{
		Query:      strings.TrimSpace(query.Get("q")),
		City:       strings.TrimSpace(query.Get("city")),
		PostalCode: strings.TrimSpace(query.Get("postal_code")),
		Sort:       strings.TrimSpace(query.Get("sort")),
	}

	if raw := strings.TrimSpace(query.Get("search")); raw != "" && filters.Query == "" {
		filters.Query = raw
	}
	if raw := strings.TrimSpace(query.Get("organization_id")); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			return filters, errors.New("invalid organization_id")
		}
		filters.OrganizationID = &id
	}
	filters.CategorySlugs = splitQueryList(query.Get("category"))
	filters.CategorySlugs = append(filters.CategorySlugs, splitQueryList(query.Get("categories"))...)

	if raw := strings.TrimSpace(query.Get("date")); raw != "" {
		value, err := parseDateOrTime(raw)
		if err != nil {
			return filters, errors.New("invalid date")
		}
		filters.Date = &value
	}
	if raw := strings.TrimSpace(query.Get("date_from")); raw != "" {
		value, err := parseDateOrTime(raw)
		if err != nil {
			return filters, errors.New("invalid date_from")
		}
		filters.DateFrom = &value
	}
	if raw := strings.TrimSpace(query.Get("date_to")); raw != "" {
		value, err := parseDateOrTime(raw)
		if err != nil {
			return filters, errors.New("invalid date_to")
		}
		filters.DateTo = &value
	}

	if raw := strings.TrimSpace(query.Get("price_min")); raw != "" {
		value, err := strconv.ParseFloat(raw, 64)
		if err != nil || value < 0 {
			return filters, errors.New("invalid price_min")
		}
		filters.PriceMin = &value
	}
	if raw := strings.TrimSpace(query.Get("price_max")); raw != "" {
		value, err := strconv.ParseFloat(raw, 64)
		if err != nil || value < 0 {
			return filters, errors.New("invalid price_max")
		}
		filters.PriceMax = &value
	}
	if parseBoolQuery(query.Get("free")) {
		filters.FreeOnly = true
	}
	if parseBoolQuery(query.Get("paid")) {
		filters.PaidOnly = true
	}
	if filters.FreeOnly && filters.PaidOnly {
		return filters, errors.New("free and paid filters cannot be combined")
	}
	if parseBoolQuery(query.Get("include_inactive")) {
		filters.IncludeInactive = true
	}

	if bounds, ok, err := parseBounds(query.Get("north"), query.Get("south"), query.Get("east"), query.Get("west")); err != nil {
		return filters, err
	} else if ok {
		filters.Bounds = &bounds
	}

	if raw := strings.TrimSpace(query.Get("limit")); raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 0 {
			return filters, errors.New("invalid limit")
		}
		if limit > 100 {
			limit = 100
		}
		filters.Limit = limit
	}
	if raw := strings.TrimSpace(query.Get("offset")); raw != "" {
		offset, err := strconv.Atoi(raw)
		if err != nil || offset < 0 {
			return filters, errors.New("invalid offset")
		}
		filters.Offset = offset
	}

	return filters, nil
}

func parseRequiredTime(value string, field string) (time.Time, error) {
	parsed, err := parseDateOrTime(value)
	if err != nil || parsed.IsZero() {
		return time.Time{}, fmt.Errorf("%s is invalid", field)
	}
	return parsed, nil
}

func parseDateOrTime(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, errors.New("empty date")
	}
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, errors.New("invalid date")
}

func parseBounds(northRaw, southRaw, eastRaw, westRaw string) (GeoBounds, bool, error) {
	raws := []string{northRaw, southRaw, eastRaw, westRaw}
	hasAny := false
	for _, raw := range raws {
		if strings.TrimSpace(raw) != "" {
			hasAny = true
			break
		}
	}
	if !hasAny {
		return GeoBounds{}, false, nil
	}
	for _, raw := range raws {
		if strings.TrimSpace(raw) == "" {
			return GeoBounds{}, false, errors.New("all map bounds are required")
		}
	}
	north, err := strconv.ParseFloat(northRaw, 64)
	if err != nil {
		return GeoBounds{}, false, errors.New("invalid north bound")
	}
	south, err := strconv.ParseFloat(southRaw, 64)
	if err != nil {
		return GeoBounds{}, false, errors.New("invalid south bound")
	}
	east, err := strconv.ParseFloat(eastRaw, 64)
	if err != nil {
		return GeoBounds{}, false, errors.New("invalid east bound")
	}
	west, err := strconv.ParseFloat(westRaw, 64)
	if err != nil {
		return GeoBounds{}, false, errors.New("invalid west bound")
	}
	if south > north {
		return GeoBounds{}, false, errors.New("south bound must be lower than north bound")
	}
	if west > east {
		return GeoBounds{}, false, errors.New("west bound must be lower than east bound")
	}
	return GeoBounds{North: north, South: south, East: east, West: west}, true, nil
}

func splitQueryList(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(strings.ToLower(part))
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func parseBoolQuery(value string) bool {
	value = strings.TrimSpace(strings.ToLower(value))
	return value == "true" || value == "1" || value == "yes"
}

func authContext(r *http.Request) (int64, string, bool) {
	claims := middleware.GetUser(r)
	if claims == nil || claims.UserID <= 0 {
		return 0, "", false
	}
	return claims.UserID, claims.Role, true
}

func routeEventAndCategoryIDs(w http.ResponseWriter, r *http.Request) (int64, int64, bool) {
	eventID, err := httpx.ParseIDParam(r, "eventID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid event id")
		return 0, 0, false
	}
	categoryID, err := httpx.ParseIDParam(r, "categoryID")
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "invalid category id")
		return 0, 0, false
	}
	return eventID, categoryID, true
}

func writeDomainError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrEventNotFound),
		errors.Is(err, ErrCategoryNotFound),
		errors.Is(err, ErrFavoriteNotFound),
		errors.Is(err, ErrHistoryNotFound):
		httpx.WriteJSONError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrOrganizationNotFound):
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrOrganizationInactive):
		httpx.WriteJSONError(w, http.StatusConflict, err.Error())
	case errors.Is(err, ErrOrganizationUnverified):
		httpx.WriteJSONError(w, http.StatusConflict, err.Error())
	case errors.Is(err, ErrForbidden):
		httpx.WriteJSONError(w, http.StatusForbidden, err.Error())
	default:
		if strings.Contains(err.Error(), "at least one event category") {
			httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Error().Err(err).Msg("events handler failed")
		httpx.WriteJSONError(w, http.StatusInternalServerError, "internal error")
	}
}

func writeGeocodingError(w http.ResponseWriter, err error) {
	if errors.Is(err, geocoding.ErrNoMatch) {
		httpx.WriteJSONError(w, http.StatusBadRequest, "address could not be geocoded")
		return
	}

	log.Error().Err(err).Msg("event geocoding failed")
	httpx.WriteJSONError(w, http.StatusBadGateway, "address geocoding service unavailable")
}

func RegisterRoutes(r chi.Router, handler Handler, authMiddleware func(http.Handler) http.Handler) {
	r.Get("/api/events", handler.List)
	r.Get("/api/events/upcoming", handler.ListUpcoming)
	r.Get("/api/events/past", handler.ListPast)
	r.Get("/api/events/popular", handler.ListPopular)
	r.Get("/api/events/map", handler.List)
	r.Get("/api/events/{eventID}", handler.Get)
	r.Get("/api/organizations/{organizationID}/events", handler.ListByOrganization)
	r.Get("/api/event-categories", handler.ListCategories)
	r.Get("/api/event-categories/{categoryID}", handler.GetCategory)
	r.Get("/api/event-categories/{categoryID}/events", handler.ListByCategory)

	r.Group(func(pr chi.Router) {
		pr.Use(authMiddleware)

		pr.Post("/api/events", handler.Create)
		pr.Put("/api/events/{eventID}", handler.Update)
		pr.Patch("/api/events/{eventID}", handler.Update)
		pr.Delete("/api/events/{eventID}", handler.Delete)
		pr.Patch("/api/events/{eventID}/active", handler.SetActive)
		pr.Put("/api/events/{eventID}/categories", handler.ReplaceCategories)
		pr.Post("/api/events/{eventID}/categories/{categoryID}", handler.AddCategory)
		pr.Delete("/api/events/{eventID}/categories/{categoryID}", handler.RemoveCategory)

		pr.Get("/api/events/{eventID}/favorite", handler.IsFavorite)
		pr.Post("/api/events/{eventID}/favorite", handler.AddFavorite)
		pr.Delete("/api/events/{eventID}/favorite", handler.RemoveFavorite)
		pr.Get("/api/me/favorites", handler.ListFavorites)

		pr.Post("/api/events/{eventID}/history", handler.RecordHistory)
		pr.Get("/api/me/history", handler.ListHistory)
		pr.Delete("/api/me/history/{historyID}", handler.RemoveHistory)
	})
}
