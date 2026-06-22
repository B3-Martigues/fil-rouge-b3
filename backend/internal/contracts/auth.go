package contracts

type AuthUserDTO struct {
	ID        int64  `json:"id"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Role      string `json:"role"`
	IsActive  bool   `json:"is_active"`
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
