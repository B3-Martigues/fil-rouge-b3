package events

import "time"

type Event struct {
	ID               int64                `json:"id"`
	OrganizationID   *int64               `json:"organization_id"`
	Title            string               `json:"title"`
	Description      string               `json:"description"`
	StartDate        time.Time            `json:"start_date"`
	EndDate          time.Time            `json:"end_date"`
	TimeStart        *string              `json:"time_start,omitempty"`
	TimeEnd          *string              `json:"time_end,omitempty"`
	Latitude         *float64             `json:"latitude,omitempty"`
	Longitude        *float64             `json:"longitude,omitempty"`
	Address          string               `json:"address"`
	City             string               `json:"city"`
	PostalCode       string               `json:"postal_code"`
	Image            string               `json:"image"`
	Price            float64              `json:"price"`
	TicketingLink    string               `json:"ticketing_link"`
	Source           *string              `json:"source,omitempty"`
	SourceURL        *string              `json:"source_url,omitempty"`
	IsActive         bool                 `json:"is_active"`
	SuspendedUntil   *time.Time           `json:"suspended_until,omitempty"`
	SuspensionReason *string              `json:"suspension_reason,omitempty"`
	CreatedAt        time.Time            `json:"created_at"`
	UpdatedAt        time.Time            `json:"updated_at"`
	DeletedAt        *time.Time           `json:"deleted_at,omitempty"`
	CategorySlugs    []string             `json:"category_slugs"`
	Organization     *OrganizationSummary `json:"organization,omitempty"`
	FavoriteCount    int64                `json:"favorite_count"`
	HistoryCount     int64                `json:"history_count"`
}

type OrganizationSummary struct {
	ID        int64    `json:"id"`
	Name      string   `json:"name"`
	IsActive  bool     `json:"is_active"`
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
}

type Category struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type Favorite struct {
	ID        int64      `json:"id"`
	UserID    int64      `json:"user_id"`
	EventID   int64      `json:"event_id"`
	CreatedAt time.Time  `json:"created_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
	Event     *Event     `json:"event,omitempty"`
}

type History struct {
	ID        int64      `json:"id"`
	UserID    int64      `json:"user_id"`
	EventID   int64      `json:"event_id"`
	VisitedAt time.Time  `json:"visited_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
	Event     *Event     `json:"event,omitempty"`
}

type ListFilters struct {
	Query           string
	City            string
	PostalCode      string
	OrganizationID  *int64
	CategorySlugs   []string
	Date            *time.Time
	DateFrom        *time.Time
	DateTo          *time.Time
	PriceMin        *float64
	PriceMax        *float64
	FreeOnly        bool
	PaidOnly        bool
	UpcomingOnly    bool
	PastOnly        bool
	IncludeInactive bool
	IncludeDeleted  bool
	Bounds          *GeoBounds
	Sort            string
	Limit           int
	Offset          int
}

type GeoBounds struct {
	North float64
	South float64
	East  float64
	West  float64
}

type EventInput struct {
	OrganizationID int64    `json:"organization_id"`
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	StartDate      string   `json:"start_date"`
	EndDate        string   `json:"end_date"`
	Latitude       *float64 `json:"latitude"`
	Longitude      *float64 `json:"longitude"`
	Address        string   `json:"address"`
	City           string   `json:"city"`
	PostalCode     string   `json:"postal_code"`
	Image          string   `json:"image"`
	Price          float64  `json:"price"`
	TicketingLink  string   `json:"ticketing_link"`
	Source         *string  `json:"source"`
	IsActive       *bool    `json:"is_active"`
	CategorySlugs  []string `json:"category_slugs"`
	CategoryIDs    []int64  `json:"category_ids"`
}
