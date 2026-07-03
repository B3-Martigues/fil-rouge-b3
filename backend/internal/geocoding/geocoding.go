package geocoding

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const DefaultEndpoint = "https://data.geopf.fr/geocodage/search"

var ErrNoMatch = errors.New("address could not be geocoded")

type Normalizer interface {
	Normalize(ctx context.Context, address Address) (Result, error)
}

type Address struct {
	Street     string
	City       string
	PostalCode string
}

type Result struct {
	Label      string  `json:"label"`
	Address    string  `json:"address"`
	City       string  `json:"city"`
	PostalCode string  `json:"postal_code"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
}

type Client struct {
	Endpoint   string
	HTTPClient *http.Client
}

func NewClient() Client {
	return Client{
		Endpoint: DefaultEndpoint,
		HTTPClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

func (c Client) Normalize(ctx context.Context, address Address) (Result, error) {
	street := strings.TrimSpace(address.Street)
	city := strings.TrimSpace(address.City)
	postalCode := strings.TrimSpace(address.PostalCode)
	query := strings.Join(nonEmpty(street, postalCode, city), " ")
	if query == "" {
		return Result{}, ErrNoMatch
	}

	endpoint := c.Endpoint
	if endpoint == "" {
		endpoint = DefaultEndpoint
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return Result{}, fmt.Errorf("parse geocoding endpoint: %w", err)
	}

	params := parsed.Query()
	params.Set("q", query)
	params.Set("limit", "1")
	params.Set("index", "address")
	if postalCode != "" {
		params.Set("postcode", postalCode)
	}
	parsed.RawQuery = params.Encode()

	httpClient := c.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return Result{}, fmt.Errorf("create geocoding request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return Result{}, fmt.Errorf("call geocoding service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return Result{}, fmt.Errorf("geocoding service returned status %d", resp.StatusCode)
	}

	var payload response
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return Result{}, fmt.Errorf("decode geocoding response: %w", err)
	}
	if len(payload.Features) == 0 {
		return Result{}, ErrNoMatch
	}

	result, ok := resultFromFeature(payload.Features[0])
	if !ok {
		return Result{}, ErrNoMatch
	}

	return result, nil
}

func (c Client) Suggest(ctx context.Context, query string, limit int) ([]Result, error) {
	query = strings.TrimSpace(query)
	if len([]rune(query)) < 3 {
		return []Result{}, nil
	}

	if limit <= 0 {
		limit = 5
	}
	if limit > 8 {
		limit = 8
	}

	endpoint := c.Endpoint
	if endpoint == "" {
		endpoint = DefaultEndpoint
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("parse geocoding endpoint: %w", err)
	}

	params := parsed.Query()
	params.Set("q", query)
	params.Set("limit", fmt.Sprintf("%d", limit))
	params.Set("index", "address")
	parsed.RawQuery = params.Encode()

	httpClient := c.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create geocoding request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call geocoding service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("geocoding service returned status %d", resp.StatusCode)
	}

	var payload response
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode geocoding response: %w", err)
	}

	results := make([]Result, 0, len(payload.Features))
	seen := map[string]struct{}{}
	for _, feature := range payload.Features {
		result, ok := resultFromFeature(feature)
		if !ok {
			continue
		}
		key := strings.ToLower(result.Address + "|" + result.PostalCode + "|" + result.City)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		results = append(results, result)
	}

	return results, nil
}

func nonEmpty(values ...string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			out = append(out, strings.TrimSpace(value))
		}
	}
	return out
}

type response struct {
	Features []feature `json:"features"`
}

type feature struct {
	Geometry   geometry   `json:"geometry"`
	Properties properties `json:"properties"`
}

type geometry struct {
	Coordinates []float64 `json:"coordinates"`
}

type properties struct {
	Label    string `json:"label"`
	Name     string `json:"name"`
	Postcode string `json:"postcode"`
	City     string `json:"city"`
}

func resultFromFeature(feature feature) (Result, bool) {
	if len(feature.Geometry.Coordinates) < 2 {
		return Result{}, false
	}

	label := strings.TrimSpace(feature.Properties.Label)
	address := strings.TrimSpace(feature.Properties.Name)
	if address == "" {
		address = label
	}
	city := strings.TrimSpace(feature.Properties.City)
	postalCode := strings.TrimSpace(feature.Properties.Postcode)
	if address == "" || city == "" || postalCode == "" {
		return Result{}, false
	}

	if label == "" {
		label = strings.Join(nonEmpty(address, postalCode, city), " ")
	}

	return Result{
		Label:      label,
		Address:    address,
		City:       city,
		PostalCode: postalCode,
		Latitude:   feature.Geometry.Coordinates[1],
		Longitude:  feature.Geometry.Coordinates[0],
	}, true
}
