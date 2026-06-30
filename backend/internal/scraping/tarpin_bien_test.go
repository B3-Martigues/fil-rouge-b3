package scraping

import (
	"testing"
	"time"
)

func TestParseFrenchDateRange(t *testing.T) {
	start, end, err := parseFrenchDateRange("Du 05 juin 2025 au 31 decembre 2026")
	if err != nil {
		t.Fatalf("parseFrenchDateRange returned error: %v", err)
	}

	if start.Format("2006-01-02") != "2025-06-05" {
		t.Fatalf("unexpected start date: %s", start.Format("2006-01-02"))
	}
	if end.Format("2006-01-02") != "2026-12-31" {
		t.Fatalf("unexpected end date: %s", end.Format("2006-01-02"))
	}
}

func TestParseSchemaDates(t *testing.T) {
	start, end, err := parseSchemaDates("2025-06-05T10:00:00+0000", "2026-12-31T19:00:00+0000")
	if err != nil {
		t.Fatalf("parseSchemaDates returned error: %v", err)
	}
	if start.Format("2006-01-02 15:04:05") != "2025-06-05 10:00:00" {
		t.Fatalf("unexpected schema start: %s", start.Format("2006-01-02 15:04:05"))
	}
	if end.Format("2006-01-02 15:04:05") != "2026-12-31 19:00:00" {
		t.Fatalf("unexpected schema end: %s", end.Format("2006-01-02 15:04:05"))
	}
}

func TestParseTimeRange(t *testing.T) {
	start, end := parseTimeRange("10h00 à 19h00")
	if start == nil || *start != "10:00:00" {
		t.Fatalf("unexpected start time: %#v", start)
	}
	if end == nil || *end != "19:00:00" {
		t.Fatalf("unexpected end time: %#v", end)
	}
}

func TestParsePrice(t *testing.T) {
	price := parsePrice("12,50 €")
	if price == nil || *price != 13 {
		t.Fatalf("expected rounded price 13, got %#v", price)
	}

	free := parsePrice("Gratuit")
	if free == nil || *free != 0 {
		t.Fatalf("expected free price 0, got %#v", free)
	}
}

func TestBestCategoryIDs(t *testing.T) {
	categories := []eventCategory{
		{ID: 1, Slug: "concert"},
		{ID: 2, Slug: "exposition"},
		{ID: 3, Slug: "sport"},
	}

	ids := bestCategoryIDs(categories, "Une exposition dans un musee avec des oeuvres")
	if len(ids) != 1 || ids[0] != 2 {
		t.Fatalf("expected exposition category, got %#v", ids)
	}
}

func TestExtractImageSrcPrefersDisplayableLazySource(t *testing.T) {
	markup := `<img class="imagePrincipale" src="data:image/svg+xml,%3Csvg%3E" data-src="/uploads/event.jpg">`

	src := extractImageSrc(markup, "imagePrincipale")
	if src != "/uploads/event.jpg" {
		t.Fatalf("expected lazy image source, got %q", src)
	}
}

func TestBestSrcsetCandidateUsesLargestDisplayableSource(t *testing.T) {
	src := bestSrcsetCandidate("small.jpg 320w, medium.jpg 640w, large.jpg 1200w")
	if src != "large.jpg" {
		t.Fatalf("expected largest srcset candidate, got %q", src)
	}
}

func TestIsDisplayableImageURL(t *testing.T) {
	valid := isDisplayableImageURL("https://example.com/event.webp")
	if !valid {
		t.Fatal("expected https image URL to be displayable")
	}

	for _, rawURL := range []string{
		"",
		"data:image/svg+xml,%3Csvg%3E",
		"https://example.com/placeholder.svg",
		"/uploads/event.jpg",
	} {
		if isDisplayableImageURL(rawURL) {
			t.Fatalf("expected %q to be rejected", rawURL)
		}
	}
}

func TestNextDailyRun(t *testing.T) {
	location := time.FixedZone("test", 3600)
	now := time.Date(2026, 6, 30, 0, 30, 0, 0, location)
	next := nextDailyRun(now, 1, 0)
	if next.Format(time.RFC3339) != "2026-06-30T01:00:00+01:00" {
		t.Fatalf("unexpected next run before target: %s", next.Format(time.RFC3339))
	}

	now = time.Date(2026, 6, 30, 1, 0, 0, 0, location)
	next = nextDailyRun(now, 1, 0)
	if next.Format(time.RFC3339) != "2026-07-01T01:00:00+01:00" {
		t.Fatalf("unexpected next run at target: %s", next.Format(time.RFC3339))
	}
}
