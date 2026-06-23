package users

import "time"

type User struct {
	ID           int64      `json:"id"`
	AccountID    int64      `json:"account_id"`
	ProfileID    int64      `json:"user_id,omitempty"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	Role         string     `json:"role"`
	AccountType  string     `json:"account_type"`
	IsActive     bool       `json:"is_active"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty"`
}
