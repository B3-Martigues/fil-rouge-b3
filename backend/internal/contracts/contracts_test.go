package contracts

import (
	"encoding/json"
	"testing"
)

func TestAuthUserDTO_JSONContract(t *testing.T) {
	dto := AuthUserDTO{
		ID:        42,
		Email:     "ada@example.test",
		FirstName: "Ada",
		LastName:  "Lovelace",
		Role:      "admin",
		IsActive:  true,
	}

	data, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("marshal AuthUserDTO: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal AuthUserDTO map: %v", err)
	}

	for _, key := range []string{"id", "email", "first_name", "last_name", "role", "is_active"} {
		if _, ok := got[key]; !ok {
			t.Fatalf("expected JSON key %q in %s", key, string(data))
		}
	}
}

func TestUpdateAdminUserDTO_PreservesUnsetFields(t *testing.T) {
	payload := []byte(`{"email":"grace@example.test","is_active":false}`)

	var dto UpdateAdminUserDTO
	if err := json.Unmarshal(payload, &dto); err != nil {
		t.Fatalf("unmarshal UpdateAdminUserDTO: %v", err)
	}

	if dto.Email == nil || *dto.Email != "grace@example.test" {
		t.Fatalf("expected email pointer to be set")
	}
	if dto.IsActive == nil || *dto.IsActive {
		t.Fatalf("expected is_active pointer to preserve false")
	}
	if dto.Password != nil || dto.FirstName != nil || dto.LastName != nil || dto.Role != nil {
		t.Fatalf("expected omitted fields to remain nil")
	}
}
