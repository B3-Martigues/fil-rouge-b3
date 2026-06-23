package users

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

var (
	ErrUserNotFound        = errors.New("user not found")
	ErrEmailAlreadyUsed    = errors.New("email already used")
	ErrUsernameAlreadyUsed = errors.New("username already used")
)

type Repository struct {
	db *sql.DB
}

type OrganizationRegistration struct {
	Email              string
	PasswordHash       string
	MemberName         string
	MemberJobRole      string
	Name               string
	ContactEmail       string
	Description        string
	Website            string
	Address            string
	City               string
	PostalCode         string
	Logo               string
	ContactPhoneNumber string
	SIRET              string
	IsVerified         bool
	IsActive           bool
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

const userSelect = `
	SELECT
		a.id,
		u.id,
		a.login_email,
		a.password_hash,
		u.username,
		'',
		r.slug,
		at.slug,
		a.is_active,
		a.created_at,
		GREATEST(a.updated_at, u.updated_at),
		a.deleted_at
	FROM accounts a
	JOIN account_types at ON at.id = a.account_type_id
	JOIN users u ON u.account_id = a.id
	JOIN roles r ON r.id = u.role_id
`

func scanUser(scanner interface {
	Scan(dest ...any) error
}) (*User, error) {
	var user User
	var profileID int64
	err := scanner.Scan(
		&user.ID,
		&profileID,
		&user.Email,
		&user.PasswordHash,
		&user.FirstName,
		&user.LastName,
		&user.Role,
		&user.AccountType,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.DeletedAt,
	)
	if err != nil {
		return nil, err
	}
	user.AccountID = user.ID
	user.ProfileID = profileID
	if user.LastName == "" {
		user.LastName = ""
	}
	return &user, nil
}

func (r *Repository) GetByEmail(ctx context.Context, email string) (*User, error) {
	query := userSelect + `
		WHERE LOWER(a.login_email) = LOWER($1)
		  AND a.deleted_at IS NULL
		  AND u.deleted_at IS NULL
		LIMIT 1
	`

	user, err := scanUser(r.db.QueryRowContext(ctx, query, email))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("get user by email: %w", err)
	}

	return user, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (*User, error) {
	query := userSelect + `
		WHERE a.id = $1
		  AND a.deleted_at IS NULL
		  AND u.deleted_at IS NULL
		LIMIT 1
	`

	user, err := scanUser(r.db.QueryRowContext(ctx, query, id))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("get user by id: %w", err)
	}

	return user, nil
}

func (r *Repository) List(ctx context.Context) ([]User, error) {
	query := userSelect + `
		WHERE a.deleted_at IS NULL
		  AND u.deleted_at IS NULL
		ORDER BY a.id ASC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, *user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users: %w", err)
	}

	return users, nil
}

func (r *Repository) Create(ctx context.Context, user *User) (int64, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin create user tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	id, profileID, err := createAccountUserInTx(ctx, tx, user)
	if err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit create user tx: %w", err)
	}

	user.ID = id
	user.AccountID = id
	user.ProfileID = profileID

	return id, nil
}

func (r *Repository) CreateOrganization(ctx context.Context, registration OrganizationRegistration) (*User, int64, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("begin create organization tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	account := &User{
		Email:        registration.Email,
		PasswordHash: registration.PasswordHash,
		FirstName:    registration.MemberName,
		Role:         "organization",
		AccountType:  "organization",
		IsActive:     true,
	}
	accountID, userID, err := createAccountUserInTx(ctx, tx, account)
	if err != nil {
		return nil, 0, err
	}

	var organizationID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO organizations (
			account_id,
			name,
			contact_email,
			role_id,
			description,
			website,
			address,
			city,
			postal_code,
			logo,
			contact_phone_number,
			siret,
			is_verified,
			is_active
		)
		SELECT $1, $2, $3, r.id, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
		FROM roles r
		WHERE r.slug = 'organization'
		RETURNING id
	`,
		accountID,
		registration.Name,
		registration.ContactEmail,
		nullIfBlank(registration.Description),
		nullIfBlank(registration.Website),
		registration.Address,
		registration.City,
		registration.PostalCode,
		nullIfBlank(registration.Logo),
		nullIfBlank(registration.ContactPhoneNumber),
		nullIfBlank(registration.SIRET),
		registration.IsVerified,
		registration.IsActive,
	).Scan(&organizationID)
	if err != nil {
		return nil, 0, mapOrganizationConstraintError(err)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO organizers (user_id, organization_id, job_role)
		VALUES ($1, $2, $3)
	`, userID, organizationID, nullIfBlank(registration.MemberJobRole))
	if err != nil {
		return nil, 0, fmt.Errorf("create organizer: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, 0, fmt.Errorf("commit create organization tx: %w", err)
	}

	createdUser, err := r.GetByID(ctx, accountID)
	if err != nil {
		return nil, 0, err
	}

	return createdUser, organizationID, nil
}

func (r *Repository) Update(ctx context.Context, user *User, passwordHash *string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin update user tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if err := updateUserInTx(ctx, tx, user, passwordHash); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit update user tx: %w", err)
	}

	return nil
}

func (r *Repository) UpdatePreservingAdminAccess(ctx context.Context, currentUserID int64, user *User, passwordHash *string) error {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return fmt.Errorf("begin protected update user tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	activeAdmins, err := lockActiveAdminRows(ctx, tx)
	if err != nil {
		return err
	}

	originalUser, err := getUserByIDForUpdate(ctx, tx, user.ID)
	if err != nil {
		return err
	}

	if currentUserID == originalUser.ID && !isActiveAdmin(*user) {
		return ErrSelfAdminAccessRemoval
	}

	if isActiveAdmin(*originalUser) && !isActiveAdmin(*user) && activeAdmins <= 1 {
		return ErrLastActiveAdmin
	}

	if err := updateUserInTx(ctx, tx, user, passwordHash); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit protected update user tx: %w", err)
	}

	return nil
}

func (r *Repository) UpdatePassword(ctx context.Context, userID int64, passwordHash string) error {
	const query = `
		UPDATE accounts
		SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW()
		WHERE id = $2
		  AND deleted_at IS NULL
	`

	res, err := r.db.ExecContext(ctx, query, passwordHash, userID)
	if err != nil {
		return fmt.Errorf("update user password: %w", err)
	}

	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("update user password rows affected: %w", err)
	}
	if n == 0 {
		return ErrUserNotFound
	}

	return nil
}

func (r *Repository) Delete(ctx context.Context, userID int64) error {
	const query = `
		UPDATE accounts
		SET deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW(), is_active = FALSE
		WHERE id = $1
		  AND deleted_at IS NULL
	`

	res, err := r.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}

	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("delete user rows affected: %w", err)
	}
	if n == 0 {
		return ErrUserNotFound
	}

	return nil
}

func (r *Repository) DeletePreservingAdminAccess(ctx context.Context, currentUserID int64, userID int64) (*User, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return nil, fmt.Errorf("begin protected delete user tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	activeAdmins, err := lockActiveAdminRows(ctx, tx)
	if err != nil {
		return nil, err
	}

	user, err := getUserByIDForUpdate(ctx, tx, userID)
	if err != nil {
		return nil, err
	}

	if currentUserID == user.ID {
		return nil, ErrSelfDeletion
	}

	if isActiveAdmin(*user) && activeAdmins <= 1 {
		return nil, ErrLastActiveAdmin
	}

	res, err := tx.ExecContext(ctx, `
		UPDATE accounts
		SET deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW(), is_active = FALSE
		WHERE id = $1
		  AND deleted_at IS NULL
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("delete user: %w", err)
	}

	n, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("delete user rows affected: %w", err)
	}
	if n == 0 {
		return nil, ErrUserNotFound
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit protected delete user tx: %w", err)
	}

	return user, nil
}

func (r *Repository) Deactivate(ctx context.Context, userID int64) error {
	const query = `
		UPDATE accounts
		SET is_active = FALSE, updated_at = NOW()
		WHERE id = $1
		  AND deleted_at IS NULL
	`

	res, err := r.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("deactivate user: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("deactivate user rows affected: %w", err)
	}
	if n == 0 {
		return ErrUserNotFound
	}
	return nil
}

func createAccountUserInTx(ctx context.Context, tx *sql.Tx, user *User) (int64, int64, error) {
	role := strings.TrimSpace(strings.ToLower(user.Role))
	accountType := strings.TrimSpace(strings.ToLower(user.AccountType))
	if accountType == "" {
		accountType = role
	}
	username := strings.TrimSpace(user.FirstName)
	if username == "" {
		username = strings.TrimSpace(user.LastName)
	}
	if username == "" {
		username = strings.Split(user.Email, "@")[0]
	}

	var accountID int64
	err := tx.QueryRowContext(ctx, `
		INSERT INTO accounts (account_type_id, login_email, password_hash, is_active)
		SELECT at.id, $1, $2, $3
		FROM account_types at
		WHERE at.slug = $4
		RETURNING id
	`, user.Email, user.PasswordHash, user.IsActive, accountType).Scan(&accountID)
	if err != nil {
		return 0, 0, mapConstraintError("create account", err)
	}

	var userID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO users (account_id, username, role_id)
		SELECT $1, $2, r.id
		FROM roles r
		WHERE r.slug = $3
		RETURNING id
	`, accountID, username, role).Scan(&userID)
	if err != nil {
		return 0, 0, mapConstraintError("create user profile", err)
	}

	return accountID, userID, nil
}

func updateUserInTx(ctx context.Context, tx *sql.Tx, user *User, passwordHash *string) error {
	role := strings.TrimSpace(strings.ToLower(user.Role))
	accountType := strings.TrimSpace(strings.ToLower(user.AccountType))
	if accountType == "" {
		accountType = role
	}
	username := strings.TrimSpace(user.FirstName)
	if username == "" {
		username = strings.TrimSpace(user.LastName)
	}
	if username == "" {
		username = strings.Split(user.Email, "@")[0]
	}

	res, err := tx.ExecContext(ctx, `
		UPDATE accounts
		SET
			login_email = $1,
			account_type_id = (SELECT id FROM account_types WHERE slug = $2),
			is_active = $3,
			updated_at = NOW()
		WHERE id = $4
		  AND deleted_at IS NULL
	`, user.Email, accountType, user.IsActive, user.ID)
	if err != nil {
		return mapConstraintError("update account", err)
	}

	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("update account rows affected: %w", err)
	}
	if n == 0 {
		return ErrUserNotFound
	}

	res, err = tx.ExecContext(ctx, `
		UPDATE users
		SET
			username = $1,
			role_id = (SELECT id FROM roles WHERE slug = $2),
			updated_at = NOW()
		WHERE account_id = $3
		  AND deleted_at IS NULL
	`, username, role, user.ID)
	if err != nil {
		return mapConstraintError("update user profile", err)
	}

	n, err = res.RowsAffected()
	if err != nil {
		return fmt.Errorf("update user rows affected: %w", err)
	}
	if n == 0 {
		return ErrUserNotFound
	}

	if passwordHash == nil {
		return nil
	}

	res, err = tx.ExecContext(ctx, `
		UPDATE accounts
		SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW()
		WHERE id = $2
		  AND deleted_at IS NULL
	`, *passwordHash, user.ID)
	if err != nil {
		return fmt.Errorf("update user password: %w", err)
	}

	n, err = res.RowsAffected()
	if err != nil {
		return fmt.Errorf("update user password rows affected: %w", err)
	}
	if n == 0 {
		return ErrUserNotFound
	}

	return nil
}

func getUserByIDForUpdate(ctx context.Context, tx *sql.Tx, id int64) (*User, error) {
	query := userSelect + `
		WHERE a.id = $1
		  AND a.deleted_at IS NULL
		  AND u.deleted_at IS NULL
		FOR UPDATE OF a, u
	`

	user, err := scanUser(tx.QueryRowContext(ctx, query, id))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("get user by id for update: %w", err)
	}

	return user, nil
}

func lockActiveAdminRows(ctx context.Context, tx *sql.Tx) (int, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT a.id
		FROM accounts a
		JOIN users u ON u.account_id = a.id
		JOIN roles r ON r.id = u.role_id
		WHERE r.slug = 'admin'
		  AND a.is_active = TRUE
		  AND a.deleted_at IS NULL
		  AND u.deleted_at IS NULL
		ORDER BY a.id
		FOR UPDATE OF a, u
	`)
	if err != nil {
		return 0, fmt.Errorf("lock active admin rows: %w", err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return 0, fmt.Errorf("scan active admin row: %w", err)
		}
		count++
	}

	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("iterate active admin rows: %w", err)
	}

	return count, nil
}

func mapConstraintError(action string, err error) error {
	msg := err.Error()
	if strings.Contains(msg, "idx_accounts_login_email_active") ||
		strings.Contains(msg, "accounts_login_email") {
		return ErrEmailAlreadyUsed
	}
	if strings.Contains(msg, "idx_users_username_active") ||
		strings.Contains(msg, "users_username") {
		return ErrUsernameAlreadyUsed
	}

	return fmt.Errorf("%s: %w", action, err)
}

func mapOrganizationConstraintError(err error) error {
	msg := err.Error()
	if strings.Contains(msg, "idx_organizations_contact_email_active") ||
		strings.Contains(msg, "organizations_contact_email") {
		return ErrEmailAlreadyUsed
	}

	return fmt.Errorf("create organization: %w", err)
}

func nullIfBlank(value string) sql.NullString {
	value = strings.TrimSpace(value)
	return sql.NullString{String: value, Valid: value != ""}
}
