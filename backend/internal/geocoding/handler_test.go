package geocoding

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type fakeSuggester struct {
	calls int
	query string
	limit int
	out   []Result
}

func (s *fakeSuggester) Suggest(_ context.Context, query string, limit int) ([]Result, error) {
	s.calls++
	s.query = query
	s.limit = limit
	return s.out, nil
}

type fakeSuggestionCache struct {
	values map[string][]Result
	sets   int
	ttl    time.Duration
}

func (c *fakeSuggestionCache) Get(_ context.Context, key string) ([]Result, bool) {
	if c.values == nil {
		return nil, false
	}
	value, ok := c.values[key]
	return value, ok
}

func (c *fakeSuggestionCache) Set(_ context.Context, key string, suggestions []Result, ttl time.Duration) {
	if c.values == nil {
		c.values = map[string][]Result{}
	}
	c.values[key] = suggestions
	c.sets++
	c.ttl = ttl
}

func TestHandlerSuggestRejectsShortQueryBeforeSuggester(t *testing.T) {
	suggester := &fakeSuggester{}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/geocoding/suggestions?q=ab", nil)

	Handler{Suggester: suggester}.Suggest(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	if suggester.calls != 0 {
		t.Fatalf("expected short query to skip suggester, got %d calls", suggester.calls)
	}

	var got []Result
	if err := json.NewDecoder(recorder.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty suggestions, got %#v", got)
	}
}

func TestHandlerSuggestCachesByNormalizedQueryAndLimit(t *testing.T) {
	result := Result{
		Label:      "8 Rue du Port 92000 Nanterre",
		Address:    "8 Rue du Port",
		City:       "Nanterre",
		PostalCode: "92000",
		Latitude:   48.893461,
		Longitude:  2.178892,
	}
	suggester := &fakeSuggester{out: []Result{result}}
	cache := &fakeSuggestionCache{}
	handler := Handler{Suggester: suggester, Cache: cache}

	firstRecorder := httptest.NewRecorder()
	firstRequest := httptest.NewRequest(http.MethodGet, "/api/geocoding/suggestions?q=%208%20Rue%20du%20Port%20&limit=99", nil)
	handler.Suggest(firstRecorder, firstRequest)

	if firstRecorder.Code != http.StatusOK {
		t.Fatalf("expected first status 200, got %d", firstRecorder.Code)
	}
	if suggester.calls != 1 {
		t.Fatalf("expected cache miss to call suggester once, got %d", suggester.calls)
	}
	if suggester.query != "8 Rue du Port" {
		t.Fatalf("expected trimmed query, got %q", suggester.query)
	}
	if suggester.limit != maxSuggestionLimit {
		t.Fatalf("expected limit capped to %d, got %d", maxSuggestionLimit, suggester.limit)
	}
	if cache.sets != 1 || cache.ttl != suggestionCacheTTL {
		t.Fatalf("expected cache write with ttl %s, got sets=%d ttl=%s", suggestionCacheTTL, cache.sets, cache.ttl)
	}

	secondRecorder := httptest.NewRecorder()
	secondRequest := httptest.NewRequest(http.MethodGet, "/api/geocoding/suggestions?q=8%20rue%20du%20port&limit=8", nil)
	handler.Suggest(secondRecorder, secondRequest)

	if secondRecorder.Code != http.StatusOK {
		t.Fatalf("expected second status 200, got %d", secondRecorder.Code)
	}
	if suggester.calls != 1 {
		t.Fatalf("expected cache hit to skip suggester, got %d calls", suggester.calls)
	}

	var got []Result
	if err := json.NewDecoder(secondRecorder.Body).Decode(&got); err != nil {
		t.Fatalf("decode cached response: %v", err)
	}
	if len(got) != 1 || got[0].Label != result.Label {
		t.Fatalf("unexpected cached suggestions: %#v", got)
	}
}

func TestNewSuggestionCacheFallsBackToMemoryCache(t *testing.T) {
	cache := NewSuggestionCache(nil)
	if cache == nil {
		t.Fatal("expected memory cache fallback")
	}

	key := suggestionCacheKey("8 rue du port", 5)
	want := []Result{{Label: "8 Rue du Port 92000 Nanterre"}}
	cache.Set(context.Background(), key, want, time.Minute)
	want[0].Label = "mutated"

	got, ok := cache.Get(context.Background(), key)
	if !ok {
		t.Fatal("expected cached suggestions")
	}
	if len(got) != 1 || got[0].Label != "8 Rue du Port 92000 Nanterre" {
		t.Fatalf("unexpected cached value: %#v", got)
	}
}
