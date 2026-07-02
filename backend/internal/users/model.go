package users

import "time"

type User struct {
	ID             int64      `json:"id"`
	AccountID      int64      `json:"account_id"`
	ProfileID      int64      `json:"user_id,omitempty"`
	OrganizationID int64      `json:"organization_id,omitempty"`
	Email          string     `json:"email"`
	PasswordHash   string     `json:"-"`
	FirstName      string     `json:"first_name"`
	LastName       string     `json:"last_name"`
	Role           string     `json:"role"`
	AccountType    string     `json:"account_type"`
	IsActive       bool       `json:"is_active"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

type EventPreference struct {
	ID              int64     `json:"id"`
	UserID          int64     `json:"user_id"`
	EventCategoryID int64     `json:"event_category_id"`
	CategorySlug    string    `json:"category_slug"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type Notification struct {
	ID                 int64      `json:"id"`
	UserID             int64      `json:"user_id"`
	EventID            *int64     `json:"event_id,omitempty"`
	OrganizationID     *int64     `json:"organization_id,omitempty"`
	NotificationTypeID int64      `json:"notification_type_id"`
	Title              string     `json:"title"`
	Message            string     `json:"message"`
	IsRead             bool       `json:"is_read"`
	ReadAt             *time.Time `json:"read_at,omitempty"`
	ActionURL          *string    `json:"action_url,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

type NotificationType struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}
