package events

import (
	"testing"
	"time"
)

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

func TestListFiltersCacheKeyIncludesQueryAffectingFilters(t *testing.T) {
	orgID := int64(42)
	date := time.Date(2026, 7, 7, 10, 30, 0, 0, time.FixedZone("CEST", 2*60*60))
	dateFrom := date.Add(-time.Hour)
	dateTo := date.Add(time.Hour)
	priceMin := 5.5
	priceMax := 20.0

	base := ListFilters{
		Query:           "music",
		City:            "Paris",
		PostalCode:      "75001",
		OrganizationID:  &orgID,
		CategorySlugs:   []string{"concert"},
		Date:            &date,
		DateFrom:        &dateFrom,
		DateTo:          &dateTo,
		PriceMin:        &priceMin,
		PriceMax:        &priceMax,
		FreeOnly:        false,
		PaidOnly:        true,
		UpcomingOnly:    true,
		PastOnly:        false,
		IncludeInactive: false,
		IncludeDeleted:  false,
		Bounds:          &GeoBounds{North: 49, South: 48, East: 3, West: 2},
		Sort:            "date-asc",
		Limit:           25,
		Offset:          50,
	}
	baseKey := base.CacheKey()

	tests := []struct {
		name   string
		mutate func(*ListFilters)
	}{
		{"query", func(f *ListFilters) { f.Query = "expo" }},
		{"city", func(f *ListFilters) { f.City = "Lyon" }},
		{"postal code", func(f *ListFilters) { f.PostalCode = "69001" }},
		{"organization", func(f *ListFilters) { id := int64(7); f.OrganizationID = &id }},
		{"category", func(f *ListFilters) { f.CategorySlugs = []string{"theatre"} }},
		{"date", func(f *ListFilters) { d := date.Add(24 * time.Hour); f.Date = &d }},
		{"date from", func(f *ListFilters) { d := dateFrom.Add(24 * time.Hour); f.DateFrom = &d }},
		{"date to", func(f *ListFilters) { d := dateTo.Add(24 * time.Hour); f.DateTo = &d }},
		{"price min", func(f *ListFilters) { v := 10.0; f.PriceMin = &v }},
		{"price max", func(f *ListFilters) { v := 30.0; f.PriceMax = &v }},
		{"free", func(f *ListFilters) { f.FreeOnly = true; f.PaidOnly = false }},
		{"paid", func(f *ListFilters) { f.PaidOnly = false }},
		{"upcoming", func(f *ListFilters) { f.UpcomingOnly = false }},
		{"past", func(f *ListFilters) { f.PastOnly = true }},
		{"include inactive", func(f *ListFilters) { f.IncludeInactive = true }},
		{"include deleted", func(f *ListFilters) { f.IncludeDeleted = true }},
		{"bounds", func(f *ListFilters) { f.Bounds = &GeoBounds{North: 50, South: 48, East: 3, West: 2} }},
		{"sort", func(f *ListFilters) { f.Sort = "price-desc" }},
		{"limit", func(f *ListFilters) { f.Limit = 10 }},
		{"offset", func(f *ListFilters) { f.Offset = 75 }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filters := base
			tt.mutate(&filters)
			if got := filters.CacheKey(); got == baseKey {
				t.Fatalf("expected cache key to change for %s", tt.name)
			}
		})
	}
}

func TestListFiltersCacheKeyNormalizesCategoryOrderAndCase(t *testing.T) {
	left := ListFilters{CategorySlugs: []string{" Concert ", "expo"}}
	right := ListFilters{CategorySlugs: []string{"EXPO", "concert"}}

	if left.CacheKey() != right.CacheKey() {
		t.Fatal("expected category order and case to be normalized")
	}
}

func TestEventByIDCacheKeySeparatesVisibility(t *testing.T) {
	publicKey := eventByIDCacheKey(12, false, false)
	staffKey := eventByIDCacheKey(12, true, false)
	deletedKey := eventByIDCacheKey(12, true, true)

	if publicKey == staffKey || staffKey == deletedKey || publicKey == deletedKey {
		t.Fatal("expected detail cache keys to differ by visibility flags")
	}
}
