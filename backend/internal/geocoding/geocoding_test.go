package geocoding

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientNormalizeUsesFirstFeature(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("q"); got != "8 bd du port 92000 Nanterre" {
			t.Fatalf("expected query to include full address, got %q", got)
		}
		if got := r.URL.Query().Get("postcode"); got != "92000" {
			t.Fatalf("expected postcode filter, got %q", got)
		}
		if got := r.URL.Query().Get("index"); got != "address" {
			t.Fatalf("expected address index, got %q", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"features": [{
				"geometry": { "coordinates": [2.178892, 48.893461] },
				"properties": {
					"name": "8 Rue du Port",
					"postcode": "92000",
					"city": "Nanterre"
				}
			}]
		}`))
	}))
	defer server.Close()

	client := Client{
		Endpoint:   server.URL,
		HTTPClient: server.Client(),
	}

	got, err := client.Normalize(context.Background(), Address{
		Street:     "8 bd du port",
		PostalCode: "92000",
		City:       "Nanterre",
	})
	if err != nil {
		t.Fatalf("expected normalized address: %v", err)
	}

	if got.Address != "8 Rue du Port" || got.City != "Nanterre" || got.PostalCode != "92000" {
		t.Fatalf("unexpected normalized address: %#v", got)
	}
	if got.Longitude != 2.178892 || got.Latitude != 48.893461 {
		t.Fatalf("unexpected coordinates: %#v", got)
	}
}

func TestClientSuggestReturnsDedupedFeatures(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("q"); got != "8 rue du port" {
			t.Fatalf("expected suggestion query, got %q", got)
		}
		if got := r.URL.Query().Get("limit"); got != "3" {
			t.Fatalf("expected limit 3, got %q", got)
		}
		if got := r.URL.Query().Get("index"); got != "address" {
			t.Fatalf("expected address index, got %q", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"features": [
				{
					"geometry": { "coordinates": [2.178892, 48.893461] },
					"properties": {
						"label": "8 Rue du Port 92000 Nanterre",
						"name": "8 Rue du Port",
						"postcode": "92000",
						"city": "Nanterre"
					}
				},
				{
					"geometry": { "coordinates": [2.178892, 48.893461] },
					"properties": {
						"label": "8 Rue du Port 92000 Nanterre",
						"name": "8 Rue du Port",
						"postcode": "92000",
						"city": "Nanterre"
					}
				},
				{
					"geometry": { "coordinates": [5.36978, 43.296482] },
					"properties": {
						"label": "8 Rue du Port 13002 Marseille",
						"name": "8 Rue du Port",
						"postcode": "13002",
						"city": "Marseille"
					}
				}
			]
		}`))
	}))
	defer server.Close()

	client := Client{
		Endpoint:   server.URL,
		HTTPClient: server.Client(),
	}

	got, err := client.Suggest(context.Background(), "8 rue du port", 3)
	if err != nil {
		t.Fatalf("expected suggestions: %v", err)
	}

	if len(got) != 2 {
		t.Fatalf("expected deduped suggestions, got %#v", got)
	}
	if got[0].Label != "8 Rue du Port 92000 Nanterre" || got[1].City != "Marseille" {
		t.Fatalf("unexpected suggestions: %#v", got)
	}
}
