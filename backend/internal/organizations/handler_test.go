package organizations

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDecodeAndValidateOrganizationInput_NormalizesPayload(t *testing.T) {
	body := bytes.NewBufferString(`{
		"name": "  Maison Culture  ",
		"contact_email": "CONTACT@EXAMPLE.FR",
		"description": "  Programmation locale  ",
		"website": " https://example.fr ",
		"latitude": 43.2965,
		"longitude": 5.3698,
		"address": "  12 rue de la Republique ",
		"city": " Marseille ",
		"postal_code": " 13002 ",
		"siret": " 12345678901234 ",
		"category_slugs": [" Culture ", "culture", "musique", ""]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/organizations", body)
	req.Header.Set("Content-Type", "application/json")

	input, err := decodeAndValidateOrganizationInput(httptest.NewRecorder(), req)
	if err != nil {
		t.Fatalf("expected valid input: %v", err)
	}

	if input.Name != "Maison Culture" {
		t.Fatalf("expected trimmed name, got %q", input.Name)
	}
	if input.ContactEmail != "contact@example.fr" {
		t.Fatalf("expected normalized email, got %q", input.ContactEmail)
	}
	if input.Description == nil || *input.Description != "Programmation locale" {
		t.Fatalf("expected trimmed description, got %#v", input.Description)
	}
	if len(input.CategorySlugs) != 2 || input.CategorySlugs[0] != "culture" || input.CategorySlugs[1] != "musique" {
		t.Fatalf("expected normalized category slugs, got %#v", input.CategorySlugs)
	}
}

func TestDecodeAndValidateOrganizationInput_RequiresBusinessFields(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{
			name: "missing name",
			body: `{"contact_email":"contact@example.fr","address":"12 rue","city":"Marseille","postal_code":"13002"}`,
			want: "name is required",
		},
		{
			name: "invalid email",
			body: `{"name":"Maison","contact_email":"bad","address":"12 rue","city":"Marseille","postal_code":"13002"}`,
			want: "contact_email is invalid",
		},
		{
			name: "missing address",
			body: `{"name":"Maison","contact_email":"contact@example.fr","city":"Marseille","postal_code":"13002"}`,
			want: "address is required",
		},
		{
			name: "invalid latitude",
			body: `{"name":"Maison","contact_email":"contact@example.fr","address":"12 rue","city":"Marseille","postal_code":"13002","latitude":100}`,
			want: "latitude must be between -90 and 90",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/organizations", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")

			_, err := decodeAndValidateOrganizationInput(httptest.NewRecorder(), req)
			if err == nil || err.Error() != tt.want {
				t.Fatalf("expected %q, got %v", tt.want, err)
			}
		})
	}
}
