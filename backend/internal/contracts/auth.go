package contracts

type AuthUserDTO struct {
	ID             int64  `json:"id"`
	AccountID      int64  `json:"account_id"`
	Email          string `json:"email"`
	LoginEmail     string `json:"login_email"`
	FirstName      string `json:"first_name"`
	LastName       string `json:"last_name"`
	Username       string `json:"username"`
	Role           string `json:"role"`
	AccountType    string `json:"account_type"`
	IsActive       bool   `json:"is_active"`
	OrganizationID *int64 `json:"organization_id,omitempty"`
}

type LoginRequestDTO struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponseDTO struct {
	OK        bool        `json:"ok"`
	User      AuthUserDTO `json:"user"`
	CSRFToken string      `json:"csrf_token,omitempty"`
}

type RegisterUserRequestDTO struct {
	LoginEmail string `json:"login_email"`
	Email      string `json:"email"`
	Username   string `json:"username"`
	Password   string `json:"password"`
}

type RegisterOrganizationRequestDTO struct {
	LoginEmail         string `json:"login_email"`
	Email              string `json:"email"`
	Password           string `json:"password"`
	MemberName         string `json:"member_name"`
	MemberJobRole      string `json:"member_job_role"`
	Name               string `json:"name"`
	ContactEmail       string `json:"contact_email"`
	Description        string `json:"description"`
	Website            string `json:"website"`
	Address            string `json:"address"`
	City               string `json:"city"`
	PostalCode         string `json:"postal_code"`
	Logo               string `json:"logo"`
	ContactPhoneNumber string `json:"contact_phone_number"`
	SIRET              string `json:"siret"`
}

type ChangePasswordRequestDTO struct {
	CurrentPassword string `json:"current_password"`
	OldPassword     string `json:"old_password"`
	NewPassword     string `json:"new_password"`
}

type AuthCheckResponseDTO struct {
	OK      bool   `json:"ok"`
	Allowed bool   `json:"allowed"`
	Actual  string `json:"actual"`
}
