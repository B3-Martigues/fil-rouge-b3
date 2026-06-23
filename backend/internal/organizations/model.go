package organizations

import "time"

type Organization struct {
	ID                 int64      `json:"id"`
	AccountID          int64      `json:"account_id"`
	Name               string     `json:"name"`
	ContactEmail       string     `json:"contact_email"`
	RoleID             *int64     `json:"role_id,omitempty"`
	Description        *string    `json:"description,omitempty"`
	Website            *string    `json:"website,omitempty"`
	Latitude           *float64   `json:"latitude,omitempty"`
	Longitude          *float64   `json:"longitude,omitempty"`
	Address            string     `json:"address"`
	City               string     `json:"city"`
	PostalCode         string     `json:"postal_code"`
	Logo               *string    `json:"logo,omitempty"`
	ContactPhoneNumber *string    `json:"contact_phone_number,omitempty"`
	SIRET              *string    `json:"siret,omitempty"`
	IsVerified         bool       `json:"is_verified"`
	IsActive           bool       `json:"is_active"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	DeletedAt          *time.Time `json:"deleted_at,omitempty"`
	CategorySlugs      []string   `json:"category_slugs"`
}

type Category struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type Organizer struct {
	ID             int64      `json:"id"`
	UserID         int64      `json:"user_id"`
	OrganizationID int64      `json:"organization_id"`
	JobRole        *string    `json:"job_role,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

type OrganizationInput struct {
	AccountID          *int64   `json:"account_id"`
	Name               string   `json:"name"`
	ContactEmail       string   `json:"contact_email"`
	Description        *string  `json:"description"`
	Website            *string  `json:"website"`
	Latitude           *float64 `json:"latitude"`
	Longitude          *float64 `json:"longitude"`
	Address            string   `json:"address"`
	City               string   `json:"city"`
	PostalCode         string   `json:"postal_code"`
	Logo               *string  `json:"logo"`
	ContactPhoneNumber *string  `json:"contact_phone_number"`
	SIRET              *string  `json:"siret"`
	IsVerified         *bool    `json:"is_verified"`
	IsActive           *bool    `json:"is_active"`
	CategorySlugs      []string `json:"category_slugs"`
	CategoryIDs        []int64  `json:"category_ids"`
}

type StatusInput struct {
	IsActive bool `json:"is_active"`
}

type VerificationInput struct {
	IsVerified bool `json:"is_verified"`
}

type MemberInput struct {
	UserID  int64   `json:"user_id"`
	JobRole *string `json:"job_role"`
}

type ListFilters struct {
	Query           string
	IncludeInactive bool
	IncludeDeleted  bool
	AccountID       *int64
}
