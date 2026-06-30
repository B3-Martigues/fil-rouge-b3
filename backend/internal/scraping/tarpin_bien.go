package scraping

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	TarpinBienSource    = "Le Tarpin Bien"
	tarpinBienSearchURL = "https://tarpin-bien.com/recherche/?evenementCheck=1"
	addressAPIURL       = "https://api-adresse.data.gouv.fr/search/"
)

type TarpinBienService struct {
	db         *sql.DB
	httpClient *http.Client
	searchURL  string
	maxPages   int
}

type TarpinBienStats struct {
	SearchPagesVisited int
	DetailPagesVisited int
	Inserted           int
	SkippedDuplicates  int
	SkippedInvalid     int
}

type scrapedEvent struct {
	Title       string
	Description string
	Price       *int
	StartDate   time.Time
	EndDate     time.Time
	TimeStart   *string
	TimeEnd     *string
	Address     string
	City        string
	PostalCode  string
	Latitude    *float64
	Longitude   *float64
	ImageURL    string
	SourceURL   string
	CategoryIDs []int64
}

type eventCategory struct {
	ID   int64
	Name string
	Slug string
}

func NewTarpinBienService(db *sql.DB) *TarpinBienService {
	return &TarpinBienService{
		db: db,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
		searchURL: tarpinBienSearchURL,
		maxPages:  50,
	}
}

func (s *TarpinBienService) Run(ctx context.Context) (TarpinBienStats, error) {
	if s.db == nil {
		return TarpinBienStats{}, errors.New("scraper database is nil")
	}

	categories, err := s.loadCategories(ctx)
	if err != nil {
		return TarpinBienStats{}, err
	}

	detailURLs, visitedPages, err := s.collectDetailURLs(ctx)
	if err != nil {
		return TarpinBienStats{}, err
	}

	stats := TarpinBienStats{SearchPagesVisited: visitedPages}
	for _, detailURL := range detailURLs {
		select {
		case <-ctx.Done():
			return stats, ctx.Err()
		default:
		}

		event, err := s.scrapeDetail(ctx, detailURL)
		stats.DetailPagesVisited++
		if err != nil {
			stats.SkippedInvalid++
			log.Warn().Err(err).Str("url", detailURL).Msg("skipping scraped event")
			continue
		}
		if event.Latitude == nil || event.Longitude == nil {
			stats.SkippedInvalid++
			log.Warn().Str("url", detailURL).Str("address", event.Address).Msg("skipping scraped event without coordinates")
			continue
		}
		event.CategoryIDs = bestCategoryIDs(categories, event.Title+" "+event.Description)

		inserted, err := s.insertIfNew(ctx, event)
		if err != nil {
			stats.SkippedInvalid++
			log.Warn().Err(err).Str("url", detailURL).Msg("failed to insert scraped event")
			continue
		}
		if inserted {
			stats.Inserted++
		} else {
			stats.SkippedDuplicates++
		}

		timer := time.NewTimer(250 * time.Millisecond)
		select {
		case <-ctx.Done():
			timer.Stop()
			return stats, ctx.Err()
		case <-timer.C:
		}
	}

	return stats, nil
}

func (s *TarpinBienService) collectDetailURLs(ctx context.Context) ([]string, int, error) {
	queue := []string{s.searchURL}
	visited := map[string]struct{}{}
	detailSeen := map[string]struct{}{}
	detailURLs := []string{}

	for len(queue) > 0 && len(visited) < s.maxPages {
		current := queue[0]
		queue = queue[1:]
		if _, ok := visited[current]; ok {
			continue
		}
		visited[current] = struct{}{}

		body, err := s.fetch(ctx, current)
		if err != nil {
			return detailURLs, len(visited), err
		}

		bloc := extractEventResultBlock(body)
		if bloc == "" {
			log.Warn().Str("url", current).Msg("event result block not found")
			continue
		}

		for _, href := range extractAnchors(bloc, "tribe-events-read-more") {
			absolute, ok := absoluteURL(current, href)
			if !ok || !isTarpinEventURL(absolute) {
				continue
			}
			if _, exists := detailSeen[absolute]; exists {
				continue
			}
			detailSeen[absolute] = struct{}{}
			detailURLs = append(detailURLs, absolute)
		}

		for _, href := range extractAnchors(body, "") {
			absolute, ok := absoluteURL(current, href)
			if !ok || !isSearchPaginationURL(absolute) {
				continue
			}
			if _, exists := visited[absolute]; exists {
				continue
			}
			queue = append(queue, absolute)
		}
	}

	sort.Strings(detailURLs)
	return detailURLs, len(visited), nil
}

func (s *TarpinBienService) scrapeDetail(ctx context.Context, detailURL string) (scrapedEvent, error) {
	body, err := s.fetch(ctx, detailURL)
	if err != nil {
		return scrapedEvent{}, err
	}
	structured := extractSchemaEvent(body)

	titleBlock := extractFirstDivByClass(body, "titreEvent")
	title := cleanText(extractFirstTag(titleBlock, "h1"))
	if title == "" {
		title = cleanText(extractFirstTag(body, "h1"))
	}
	if title == "" {
		title = strings.TrimSpace(structured.Name)
	}
	if title == "" {
		return scrapedEvent{}, errors.New("missing title")
	}

	descriptionBlock := extractFirstDivByClass(body, "description")
	description := descriptionFromParagraphs(descriptionBlock)
	if description == "" {
		description = cleanText(structured.Description)
	}

	price := parsePrice(extractPriceText(body))

	plage := extractFirstDivByClass(body, "plage")
	startDate, endDate, err := parseFrenchDateRange(cleanText(extractFirstElementByClass(plage, "dates")))
	if err != nil {
		startDate, endDate, err = parseSchemaDates(structured.StartDate, structured.EndDate)
		if err != nil {
			return scrapedEvent{}, err
		}
	}
	timeStart, timeEnd := parseTimeRange(extractPlageTimeText(plage))
	if timeStart == nil || timeEnd == nil {
		timeStart, timeEnd = timesFromDates(startDate, endDate)
	}

	rawAddress := cleanText(extractFirstTag(titleBlock, "address"))
	if rawAddress == "" {
		rawAddress = cleanText(structured.Location.Address)
	}
	normalizedAddress, err := s.normalizeAddress(ctx, rawAddress)
	if err != nil {
		log.Warn().Err(err).Str("address", rawAddress).Msg("address normalization failed")
		normalizedAddress = addressCandidate{Label: rawAddress}
	}

	imageURL := ""
	if src := extractImageSrc(body, "imagePrincipale"); src != "" {
		if absolute, ok := absoluteURL(detailURL, src); ok {
			imageURL = absolute
		}
	}
	if imageURL == "" && structured.Image != "" {
		if absolute, ok := absoluteURL(detailURL, structured.Image); ok {
			imageURL = absolute
		}
	}
	if !isDisplayableImageURL(imageURL) {
		return scrapedEvent{}, errors.New("missing valid image")
	}
	if err := s.validateRemoteImage(ctx, imageURL); err != nil {
		return scrapedEvent{}, fmt.Errorf("invalid image: %w", err)
	}

	return scrapedEvent{
		Title:       title,
		Description: description,
		Price:       price,
		StartDate:   startDate,
		EndDate:     endDate,
		TimeStart:   timeStart,
		TimeEnd:     timeEnd,
		Address:     firstNonEmpty(normalizedAddress.Label, rawAddress),
		City:        normalizedAddress.City,
		PostalCode:  normalizedAddress.PostalCode,
		Latitude:    normalizedAddress.Latitude,
		Longitude:   normalizedAddress.Longitude,
		ImageURL:    imageURL,
		SourceURL:   detailURL,
	}, nil
}

func (s *TarpinBienService) fetch(ctx context.Context, rawURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "MappeningBot/1.0 (+https://mappening.local)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")

	res, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("fetch %s: status %d", rawURL, res.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(res.Body, 5<<20))
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (s *TarpinBienService) validateRemoteImage(ctx context.Context, rawURL string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, rawURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "MappeningBot/1.0 (+https://mappening.local)")
	req.Header.Set("Accept", "image/*")

	res, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusMethodNotAllowed || res.StatusCode == http.StatusNotImplemented {
		return s.validateRemoteImageWithGet(ctx, rawURL)
	}
	if err := validateImageResponse(res); err != nil {
		return s.validateRemoteImageWithGet(ctx, rawURL)
	}
	return nil
}

func (s *TarpinBienService) validateRemoteImageWithGet(ctx context.Context, rawURL string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "MappeningBot/1.0 (+https://mappening.local)")
	req.Header.Set("Accept", "image/*")
	req.Header.Set("Range", "bytes=0-0")

	res, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	return validateImageResponse(res)
}

func validateImageResponse(res *http.Response) error {
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("status %d", res.StatusCode)
	}

	contentType := strings.ToLower(strings.TrimSpace(strings.Split(res.Header.Get("Content-Type"), ";")[0]))
	if !strings.HasPrefix(contentType, "image/") || contentType == "image/svg+xml" {
		return fmt.Errorf("content type %q", contentType)
	}

	return nil
}

func (s *TarpinBienService) loadCategories(ctx context.Context) ([]eventCategory, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, slug
		FROM event_categories
		ORDER BY id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("load event categories: %w", err)
	}
	defer rows.Close()

	var categories []eventCategory
	for rows.Next() {
		var category eventCategory
		if err := rows.Scan(&category.ID, &category.Name, &category.Slug); err != nil {
			return nil, fmt.Errorf("scan event category: %w", err)
		}
		categories = append(categories, category)
	}
	return categories, rows.Err()
}

func (s *TarpinBienService) insertIfNew(ctx context.Context, event scrapedEvent) (bool, error) {
	event.EndDate = normalizeEndDate(event.StartDate, event.EndDate)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, fmt.Errorf("begin scraper insert tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var exists bool
	err = tx.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM events
			WHERE deleted_at IS NULL
			  AND (
			      (source_url IS NOT NULL AND source_url = $1)
			      OR (source = $2 AND LOWER(title) = LOWER($3) AND DATE(start_date) = DATE($4) AND address = $5)
			  )
		)
	`, event.SourceURL, TarpinBienSource, event.Title, event.StartDate, event.Address).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check scraped event duplicate: %w", err)
	}
	if exists {
		return false, tx.Commit()
	}

	var price sql.NullFloat64
	if event.Price != nil {
		price = sql.NullFloat64{Float64: float64(*event.Price), Valid: true}
	}

	var eventID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO events (
			organization_id,
			title,
			description,
			start_date,
			end_date,
			time_start,
			time_end,
			latitude,
			longitude,
			address,
			city,
			postal_code,
			image,
			price,
			ticketing_link,
			source,
			source_url,
			is_active
		)
		VALUES (
			NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9,
			$10, $11, $12, $13, NULL, $14, $15, TRUE
		)
		RETURNING id
	`,
		event.Title,
		event.Description,
		event.StartDate,
		event.EndDate,
		nullStringValue(event.TimeStart),
		nullStringValue(event.TimeEnd),
		nullFloatValue(event.Latitude),
		nullFloatValue(event.Longitude),
		event.Address,
		event.City,
		event.PostalCode,
		event.ImageURL,
		price,
		TarpinBienSource,
		event.SourceURL,
	).Scan(&eventID)
	if err != nil {
		if strings.Contains(err.Error(), "idx_events_source_url_unique") {
			return false, tx.Commit()
		}
		return false, fmt.Errorf("insert scraped event: %w", err)
	}

	for _, categoryID := range event.CategoryIDs {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO event_categories_links (event_id, event_category_id)
			VALUES ($1, $2)
			ON CONFLICT (event_id, event_category_id) DO NOTHING
		`, eventID, categoryID); err != nil {
			return false, fmt.Errorf("link scraped event category: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("commit scraper insert tx: %w", err)
	}
	return true, nil
}

type addressCandidate struct {
	Label      string
	City       string
	PostalCode string
	Latitude   *float64
	Longitude  *float64
}

func (s *TarpinBienService) normalizeAddress(ctx context.Context, rawAddress string) (addressCandidate, error) {
	rawAddress = strings.TrimSpace(rawAddress)
	if rawAddress == "" {
		return addressCandidate{}, nil
	}

	endpoint, err := url.Parse(addressAPIURL)
	if err != nil {
		return addressCandidate{}, err
	}
	query := endpoint.Query()
	query.Set("q", rawAddress)
	query.Set("limit", "1")
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return addressCandidate{}, err
	}
	req.Header.Set("User-Agent", "MappeningBot/1.0 (+https://mappening.local)")
	req.Header.Set("Accept", "application/json")

	res, err := s.httpClient.Do(req)
	if err != nil {
		return addressCandidate{}, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return addressCandidate{}, fmt.Errorf("api adresse status %d", res.StatusCode)
	}

	var payload struct {
		Features []struct {
			Geometry struct {
				Coordinates []float64 `json:"coordinates"`
			} `json:"geometry"`
			Properties struct {
				Label    string `json:"label"`
				Postcode string `json:"postcode"`
				City     string `json:"city"`
			} `json:"properties"`
		} `json:"features"`
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&payload); err != nil {
		return addressCandidate{}, err
	}
	if len(payload.Features) == 0 {
		return addressCandidate{Label: rawAddress}, nil
	}

	feature := payload.Features[0]
	candidate := addressCandidate{
		Label:      firstNonEmpty(feature.Properties.Label, rawAddress),
		City:       feature.Properties.City,
		PostalCode: feature.Properties.Postcode,
	}
	if len(feature.Geometry.Coordinates) >= 2 {
		longitude := feature.Geometry.Coordinates[0]
		latitude := feature.Geometry.Coordinates[1]
		candidate.Longitude = &longitude
		candidate.Latitude = &latitude
	}
	return candidate, nil
}

func nullStringValue(value *string) sql.NullString {
	if value == nil || strings.TrimSpace(*value) == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: strings.TrimSpace(*value), Valid: true}
}

func nullFloatValue(value *float64) sql.NullFloat64 {
	if value == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *value, Valid: true}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func isTarpinEventURL(rawURL string) bool {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	return strings.EqualFold(parsed.Hostname(), "tarpin-bien.com") && strings.Contains(parsed.Path, "/evenement/")
}

func isSearchPaginationURL(rawURL string) bool {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	if !strings.EqualFold(parsed.Hostname(), "tarpin-bien.com") {
		return false
	}
	if strings.Contains(parsed.Path, "/evenement/") {
		return false
	}
	return strings.Contains(parsed.Path, "/recherche/") && (parsed.Query().Get("evenementCheck") == "1" || strings.Contains(parsed.RawQuery, "evenementCheck=1"))
}

func absoluteURL(baseURL string, href string) (string, bool) {
	href = strings.TrimSpace(html.UnescapeString(href))
	if href == "" || strings.HasPrefix(strings.ToLower(href), "javascript:") || strings.HasPrefix(href, "#") {
		return "", false
	}
	base, err := url.Parse(baseURL)
	if err != nil {
		return "", false
	}
	parsed, err := url.Parse(href)
	if err != nil {
		return "", false
	}
	return base.ResolveReference(parsed).String(), true
}

func isDisplayableImageURL(rawURL string) bool {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return false
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return false
	}
	if parsed.Host == "" {
		return false
	}

	return !strings.HasSuffix(strings.ToLower(parsed.Path), ".svg")
}

func extractEventResultBlock(markup string) string {
	bloc := extractDivByID(markup, "evenement")
	if bloc != "" {
		return bloc
	}

	markerRE := regexp.MustCompile(`(?is)<div\b[^>]*class\s*=\s*["'][^"']*\bblocResult\b[^"']*["'][^>]*id\s*=\s*["']evenement["'][^>]*>`)
	loc := markerRE.FindStringIndex(markup)
	if loc == nil {
		markerRE = regexp.MustCompile(`(?is)<div\b[^>]*id\s*=\s*["']evenement["'][^>]*class\s*=\s*["'][^"']*\bblocResult\b[^"']*["'][^>]*>`)
		loc = markerRE.FindStringIndex(markup)
	}
	if loc == nil {
		return ""
	}

	nextRE := regexp.MustCompile(`(?is)<div\b[^>]*class\s*=\s*["'][^"']*\bblocResult\b[^"']*["'][^>]*id\s*=\s*["'](lieu|activite|article|guide|shopping|restaurant|bar)["']`)
	rest := markup[loc[1]:]
	if next := nextRE.FindStringIndex(rest); next != nil {
		return markup[loc[0] : loc[1]+next[0]]
	}
	return markup[loc[0]:]
}

func bestCategoryIDs(categories []eventCategory, text string) []int64 {
	normalized := normalizeForMatch(text)
	bestScore := 0
	scores := map[int64]int{}
	for _, category := range categories {
		score := categoryScore(category.Slug, normalized)
		if score <= 0 {
			continue
		}
		scores[category.ID] = score
		if score > bestScore {
			bestScore = score
		}
	}
	if bestScore == 0 {
		return nil
	}

	ids := make([]int64, 0)
	for id, score := range scores {
		if score == bestScore {
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	return ids
}

func categoryScore(slug string, text string) int {
	score := 0
	for _, keyword := range categoryKeywords[strings.ToLower(slug)] {
		keyword = normalizeForMatch(keyword)
		if keyword != "" && strings.Contains(text, keyword) {
			score++
		}
	}
	return score
}

var categoryKeywords = map[string][]string{
	"animaux":     {"animal", "animaux", "chien", "chat"},
	"art":         {"art", "oeuvre", "artiste", "galerie", "peinture", "sculpture"},
	"associatif":  {"association", "associatif", "benevole"},
	"atelier":     {"atelier", "workshop", "initiation", "creation"},
	"automobile":  {"automobile", "voiture", "moto", "vehicule"},
	"bien-etre":   {"bien-etre", "yoga", "meditation", "massage", "relaxation"},
	"business":    {"business", "entrepreneur", "startup", "commerce"},
	"cinema":      {"cinema", "film", "projection"},
	"concert":     {"concert", "live", "musique", "groupe", "dj"},
	"conference":  {"conference", "rencontre", "debat", "table ronde"},
	"culture":     {"culture", "culturel", "patrimoine", "histoire"},
	"emploi":      {"emploi", "job", "recrutement", "carriere"},
	"enfants":     {"enfant", "kids", "jeunesse"},
	"esport":      {"esport", "e-sport", "tournoi"},
	"famille":     {"famille", "familial"},
	"festival":    {"festival", "fest", "edition"},
	"food":        {"food", "street food", "cuisine"},
	"formation":   {"formation", "cours", "apprendre"},
	"gaming":      {"gaming", "jeu video", "console"},
	"gastronomie": {"gastronomie", "degustation", "restaurant", "chef"},
	"humour":      {"humour", "stand-up", "comedie"},
	"jeux":        {"jeu", "jeux", "ludique"},
	"marche":      {"marche", "marche local", "brocante"},
	"mode":        {"mode", "fashion", "vetement"},
	"musique":     {"musique", "musical", "concert", "dj"},
	"nature":      {"nature", "ecologie", "jardin"},
	"networking":  {"networking", "reseautage", "afterwork"},
	"nightlife":   {"nightlife", "club", "boite", "nuit"},
	"patrimoine":  {"patrimoine", "monument", "musee", "histoire"},
	"plein-air":   {"plein air", "outdoor", "exterieur"},
	"randonnee":   {"randonnee", "balade", "marche"},
	"sante":       {"sante", "medical", "prevention"},
	"shopping":    {"shopping", "boutique", "vente"},
	"solidarite":  {"solidarite", "caritatif", "don"},
	"soiree":      {"soiree", "afterwork", "apero"},
	"spectacle":   {"spectacle", "scene", "show"},
	"sport":       {"sport", "course", "football", "randonnee", "velo"},
	"technologie": {"technologie", "tech", "numerique", "ia"},
	"theatre":     {"theatre", "piece", "comedien"},
	"tourisme":    {"tourisme", "visite", "decouverte"},
	"etudiant":    {"etudiant", "campus", "universite"},
	"exposition":  {"exposition", "musee", "galerie", "art", "oeuvre"},
}

func normalizeForMatch(value string) string {
	value = strings.ToLower(value)
	replacer := strings.NewReplacer(
		"à", "a", "â", "a", "ä", "a",
		"ç", "c",
		"é", "e", "è", "e", "ê", "e", "ë", "e",
		"î", "i", "ï", "i",
		"ô", "o", "ö", "o",
		"ù", "u", "û", "u", "ü", "u",
		"œ", "oe",
	)
	value = replacer.Replace(value)
	return strings.Join(strings.Fields(value), " ")
}

var (
	openDivRE  = regexp.MustCompile(`(?is)<div\b[^>]*>`)
	divTagRE   = regexp.MustCompile(`(?is)<(/?)div\b[^>]*>`)
	attrRE     = regexp.MustCompile(`(?is)\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))`)
	tagStripRE = regexp.MustCompile(`(?is)<script\b.*?</script>|<style\b.*?</style>|<[^>]+>`)
)

type schemaEvent struct {
	Name        string `json:"name"`
	Image       string `json:"image"`
	StartDate   string `json:"startDate"`
	EndDate     string `json:"endDate"`
	Description string `json:"description"`
	Location    struct {
		Address string `json:"address"`
	} `json:"location"`
}

func extractSchemaEvent(markup string) schemaEvent {
	re := regexp.MustCompile(`(?is)<script\b[^>]*type\s*=\s*["']application/ld\+json["'][^>]*>(.*?)</script>`)
	for _, match := range re.FindAllStringSubmatch(markup, -1) {
		raw := strings.TrimSpace(match[1])
		if raw == "" {
			continue
		}

		var events []schemaEvent
		if err := json.Unmarshal([]byte(raw), &events); err == nil {
			for _, event := range events {
				if event.Name != "" || event.StartDate != "" {
					return event
				}
			}
		}

		var event schemaEvent
		if err := json.Unmarshal([]byte(raw), &event); err == nil && (event.Name != "" || event.StartDate != "") {
			return event
		}
	}
	return schemaEvent{}
}

func extractDivByID(markup string, id string) string {
	for _, loc := range openDivRE.FindAllStringIndex(markup, -1) {
		tag := markup[loc[0]:loc[1]]
		if strings.EqualFold(attrValue(tag, "id"), id) {
			return extractBalancedDiv(markup, loc[0])
		}
	}
	return ""
}

func extractFirstDivByClass(markup string, className string) string {
	divs := extractDivsByClass(markup, className)
	if len(divs) == 0 {
		return ""
	}
	return divs[0]
}

func extractDivsByClass(markup string, className string) []string {
	var out []string
	for _, loc := range openDivRE.FindAllStringIndex(markup, -1) {
		tag := markup[loc[0]:loc[1]]
		if hasClass(tag, className) {
			if div := extractBalancedDiv(markup, loc[0]); div != "" {
				out = append(out, div)
			}
		}
	}
	return out
}

func extractBalancedDiv(markup string, start int) string {
	matches := divTagRE.FindAllStringSubmatchIndex(markup[start:], -1)
	depth := 0
	for _, match := range matches {
		if match[2] >= 0 {
			depth--
		} else {
			depth++
		}
		if depth == 0 {
			return markup[start : start+match[1]]
		}
	}
	return ""
}

func extractAnchors(markup string, requiredClass string) []string {
	re := regexp.MustCompile(`(?is)<a\b[^>]*>`)
	var hrefs []string
	for _, tag := range re.FindAllString(markup, -1) {
		if requiredClass != "" && !hasClass(tag, requiredClass) {
			continue
		}
		if href := attrValue(tag, "href"); href != "" {
			hrefs = append(hrefs, href)
		}
	}
	return hrefs
}

func extractImageSrc(markup string, requiredClass string) string {
	re := regexp.MustCompile(`(?is)<img\b[^>]*>`)
	for _, tag := range re.FindAllString(markup, -1) {
		if requiredClass != "" && !hasClass(tag, requiredClass) {
			continue
		}
		for _, attrName := range []string{"data-src", "data-lazy-src", "data-original", "src"} {
			if src := cleanImageSrcCandidate(attrValue(tag, attrName)); src != "" {
				return src
			}
		}
		for _, attrName := range []string{"data-srcset", "srcset"} {
			if src := bestSrcsetCandidate(attrValue(tag, attrName)); src != "" {
				return src
			}
		}
	}
	return ""
}

func cleanImageSrcCandidate(src string) string {
	src = strings.TrimSpace(html.UnescapeString(src))
	if src == "" {
		return ""
	}

	normalized := strings.ToLower(src)
	if strings.HasPrefix(normalized, "data:") || strings.HasPrefix(normalized, "javascript:") || strings.HasPrefix(src, "#") {
		return ""
	}
	return src
}

func bestSrcsetCandidate(srcset string) string {
	candidates := strings.Split(srcset, ",")
	for index := len(candidates) - 1; index >= 0; index-- {
		fields := strings.Fields(candidates[index])
		if len(fields) == 0 {
			continue
		}
		if src := cleanImageSrcCandidate(fields[0]); src != "" {
			return src
		}
	}
	return ""
}

func attrValue(tag string, name string) string {
	for _, match := range attrRE.FindAllStringSubmatch(tag, -1) {
		if strings.EqualFold(match[1], name) {
			for i := 3; i <= 5; i++ {
				if match[i] != "" {
					return html.UnescapeString(match[i])
				}
			}
		}
	}
	return ""
}

func hasClass(tag string, className string) bool {
	classes := strings.Fields(attrValue(tag, "class"))
	for _, class := range classes {
		if class == className {
			return true
		}
	}
	return false
}

func extractFirstTag(markup string, tag string) string {
	re := regexp.MustCompile(`(?is)<` + regexp.QuoteMeta(tag) + `\b[^>]*>(.*?)</` + regexp.QuoteMeta(tag) + `>`)
	match := re.FindStringSubmatch(markup)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

func extractFirstElementByClass(markup string, className string) string {
	re := regexp.MustCompile(`(?is)<[a-z0-9]+\b[^>]*class\s*=\s*["'][^"']*\b` + regexp.QuoteMeta(className) + `\b[^"']*["'][^>]*>(.*?)</[a-z0-9]+>`)
	match := re.FindStringSubmatch(markup)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

func descriptionFromParagraphs(markup string) string {
	re := regexp.MustCompile(`(?is)<p\b[^>]*>(.*?)</p>`)
	parts := []string{}
	for _, match := range re.FindAllStringSubmatch(markup, -1) {
		text := cleanText(match[1])
		if text != "" {
			parts = append(parts, text)
		}
	}
	return strings.Join(parts, "\n\n")
}

func cleanText(value string) string {
	value = tagStripRE.ReplaceAllString(value, " ")
	value = html.UnescapeString(value)
	return strings.Join(strings.Fields(value), " ")
}

func extractPriceText(markup string) string {
	tableRE := regexp.MustCompile(`(?is)<table\b[^>]*class\s*=\s*["'][^"']*\btarifs\b[^"']*["'][^>]*>.*?</table>`)
	table := tableRE.FindString(markup)
	if table == "" {
		return ""
	}
	cellRE := regexp.MustCompile(`(?is)<td\b[^>]*class\s*=\s*["'][^"']*\bnombretarif\b[^"']*["'][^>]*>(.*?)</td>`)
	match := cellRE.FindStringSubmatch(table)
	if len(match) < 2 {
		return ""
	}
	return cleanText(match[1])
}

func parsePrice(value string) *int {
	normalized := normalizeForMatch(value)
	if normalized == "" {
		return nil
	}
	if strings.Contains(normalized, "gratuit") || strings.Contains(normalized, "libre") {
		price := 0
		return &price
	}
	re := regexp.MustCompile(`\d+(?:[,.]\d+)?`)
	raw := re.FindString(normalized)
	if raw == "" {
		return nil
	}
	raw = strings.ReplaceAll(raw, ",", ".")
	parsed, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return nil
	}
	price := int(math.Round(parsed))
	return &price
}

func extractPlageTimeText(markup string) string {
	re := regexp.MustCompile(`(?is)<li\b[^>]*>.*?<strong\b[^>]*>(.*?)</strong>.*?</li>`)
	for _, match := range re.FindAllStringSubmatch(markup, -1) {
		text := cleanText(match[1])
		if strings.Contains(strings.ToLower(text), "h") {
			return text
		}
	}
	return ""
}

func parseTimeRange(value string) (*string, *string) {
	value = strings.ToLower(strings.TrimSpace(value))
	re := regexp.MustCompile(`(\d{1,2})\s*h\s*(\d{0,2})\s*(?:a|à|-)\s*(\d{1,2})\s*h\s*(\d{0,2})`)
	match := re.FindStringSubmatch(value)
	if len(match) < 5 {
		return nil, nil
	}
	start := formatClock(match[1], match[2])
	end := formatClock(match[3], match[4])
	return &start, &end
}

func formatClock(hourRaw, minuteRaw string) string {
	hour, _ := strconv.Atoi(hourRaw)
	minute := 0
	if minuteRaw != "" {
		minute, _ = strconv.Atoi(minuteRaw)
	}
	return fmt.Sprintf("%02d:%02d:00", hour, minute)
}

func parseFrenchDateRange(value string) (time.Time, time.Time, error) {
	value = normalizeForMatch(value)
	dateRE := regexp.MustCompile(`(\d{1,2})\s+([a-z]+)\s+(\d{4})`)
	matches := dateRE.FindAllStringSubmatch(value, -1)
	if len(matches) == 0 {
		return time.Time{}, time.Time{}, fmt.Errorf("missing date range: %q", value)
	}
	start, err := parseFrenchDateParts(matches[0][1], matches[0][2], matches[0][3])
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	end := start
	if len(matches) > 1 {
		end, err = parseFrenchDateParts(matches[1][1], matches[1][2], matches[1][3])
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
	}
	return start, end, nil
}

func parseSchemaDates(startRaw, endRaw string) (time.Time, time.Time, error) {
	start, err := parseSchemaDate(startRaw)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	end, err := parseSchemaDate(endRaw)
	if err != nil {
		end = start
	}
	return start, end, nil
}

func parseSchemaDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, errors.New("missing schema date")
	}
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05-0700",
		"2006-01-02T15:04:05Z0700",
		"2006-01-02T15:04:05",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid schema date %q", value)
}

func timesFromDates(startDate, endDate time.Time) (*string, *string) {
	if startDate.IsZero() || endDate.IsZero() {
		return nil, nil
	}
	start := startDate.Format("15:04:05")
	end := endDate.Format("15:04:05")
	if start == "00:00:00" && end == "00:00:00" {
		return nil, nil
	}
	return &start, &end
}

func normalizeEndDate(startDate, endDate time.Time) time.Time {
	for !endDate.IsZero() && endDate.Before(startDate) && endDate.Sub(startDate) > -48*time.Hour {
		endDate = endDate.Add(24 * time.Hour)
	}
	return endDate
}

func parseFrenchDateParts(dayRaw, monthRaw, yearRaw string) (time.Time, error) {
	day, err := strconv.Atoi(dayRaw)
	if err != nil {
		return time.Time{}, err
	}
	year, err := strconv.Atoi(yearRaw)
	if err != nil {
		return time.Time{}, err
	}
	month, ok := frenchMonths[monthRaw]
	if !ok {
		return time.Time{}, fmt.Errorf("unknown french month %q", monthRaw)
	}
	return time.Date(year, month, day, 0, 0, 0, 0, time.Local), nil
}

var frenchMonths = map[string]time.Month{
	"janvier":   time.January,
	"fevrier":   time.February,
	"mars":      time.March,
	"avril":     time.April,
	"mai":       time.May,
	"juin":      time.June,
	"juillet":   time.July,
	"aout":      time.August,
	"septembre": time.September,
	"octobre":   time.October,
	"novembre":  time.November,
	"decembre":  time.December,
}
