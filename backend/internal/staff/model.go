package staff

import "time"

type Account struct {
	ID                int64      `json:"id"`
	AccountTypeID     int64      `json:"account_type_id"`
	AccountType       string     `json:"account_type"`
	LoginEmail        string     `json:"login_email"`
	PasswordChangedAt *time.Time `json:"password_changed_at,omitempty"`
	IsActive          bool       `json:"is_active"`
	SuspendedUntil    *time.Time `json:"suspended_until,omitempty"`
	SuspensionReason  *string    `json:"suspension_reason,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	DeletedAt         *time.Time `json:"deleted_at,omitempty"`
}

type User struct {
	ID        int64      `json:"id"`
	AccountID int64      `json:"account_id"`
	Username  string     `json:"username"`
	RoleID    int64      `json:"role_id"`
	Role      string     `json:"role"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
}

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

type Organizer struct {
	ID             int64      `json:"id"`
	UserID         int64      `json:"user_id"`
	OrganizationID int64      `json:"organization_id"`
	JobRole        *string    `json:"job_role,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

type NotificationType struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
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

type ModerationReport struct {
	ID              int64      `json:"id"`
	TargetType      string     `json:"target_type"`
	TargetID        int64      `json:"target_id"`
	ReporterUserID  int64      `json:"reporter_user_id"`
	Reason          string     `json:"reason"`
	Details         string     `json:"details"`
	Status          string     `json:"status"`
	Priority        string     `json:"priority"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	ResolvedAt      *time.Time `json:"resolved_at,omitempty"`
	HandledByUserID *int64     `json:"handled_by_user_id,omitempty"`
	ResolutionNote  *string    `json:"resolution_note,omitempty"`
}

type ModerationDecision struct {
	ID              int64     `json:"id"`
	ReportID        *int64    `json:"report_id,omitempty"`
	Action          string    `json:"action"`
	TargetType      string    `json:"target_type"`
	TargetID        int64     `json:"target_id"`
	ModeratorUserID int64     `json:"moderator_user_id"`
	Reason          string    `json:"reason"`
	CreatedAt       time.Time `json:"created_at"`
}

type ActionRequest struct {
	Action         string  `json:"action"`
	TargetType     string  `json:"target_type"`
	TargetID       int64   `json:"target_id"`
	Reason         string  `json:"reason"`
	SuspendedUntil *string `json:"suspended_until"`
	ReportID       *int64  `json:"report_id"`
	ReportStatus   *string `json:"report_status"`
}

type CreateReportRequest struct {
	TargetType     string `json:"target_type"`
	TargetID       int64  `json:"target_id"`
	ReporterUserID int64  `json:"reporter_user_id"`
	Reason         string `json:"reason"`
	Details        string `json:"details"`
	Priority       string `json:"priority"`
}

type SummaryStat struct {
	Total   int64 `json:"total"`
	Pending int64 `json:"pending"`
}

type Summary struct {
	Accounts      SummaryStat `json:"accounts"`
	Events        SummaryStat `json:"events"`
	Organizations SummaryStat `json:"organizations"`
	Reports       SummaryStat `json:"reports"`
}

type ListOptions struct {
	Query  string
	Status string
	Role   string
}
