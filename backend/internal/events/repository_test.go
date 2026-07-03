package events

import "testing"

func TestCanManageOrganizationState_AllowsAdminDespiteInactiveOrUnverifiedOrganization(t *testing.T) {
	tests := []struct {
		name     string
		active   bool
		verified bool
		deleted  bool
		wantErr  error
	}{
		{
			name:     "inactive",
			active:   false,
			verified: true,
		},
		{
			name:     "unverified",
			active:   true,
			verified: false,
		},
		{
			name:     "deleted",
			active:   true,
			verified: true,
			deleted:  true,
			wantErr:  ErrOrganizationInactive,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := canManageOrganizationState(1, "admin", 2, tt.active, tt.verified, tt.deleted)
			if err != tt.wantErr {
				t.Fatalf("expected %v, got %v", tt.wantErr, err)
			}
		})
	}
}

func TestCanManageOrganizationState_RejectsNonAdminWhenOrganizationCannotBeManaged(t *testing.T) {
	tests := []struct {
		name     string
		active   bool
		verified bool
		deleted  bool
		wantErr  error
	}{
		{
			name:     "inactive",
			active:   false,
			verified: true,
			wantErr:  ErrOrganizationInactive,
		},
		{
			name:     "unverified",
			active:   true,
			verified: false,
			wantErr:  ErrOrganizationUnverified,
		},
		{
			name:     "deleted",
			active:   true,
			verified: true,
			deleted:  true,
			wantErr:  ErrOrganizationInactive,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := canManageOrganizationState(1, "organization", 1, tt.active, tt.verified, tt.deleted)
			if err != tt.wantErr {
				t.Fatalf("expected %v, got %v", tt.wantErr, err)
			}
		})
	}
}
