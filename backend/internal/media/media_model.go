package media

import "time"

type Media struct {
	ID             int64      `json:"id"`
	OwnerAccountID *int64     `json:"owner_account_id,omitempty"`
	EntityType     string     `json:"entity_type"`
	EntityID       *int64     `json:"entity_id,omitempty"`
	FileName       string     `json:"file_name"`
	FilePath       string     `json:"file_path"`
	PublicURL      string     `json:"public_url"`
	MimeType       string     `json:"mime_type"`
	SizeBytes      int64      `json:"size_bytes"`
	CreatedAt      time.Time  `json:"created_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

type Actor struct {
	AccountID int64
	Role      string
}
