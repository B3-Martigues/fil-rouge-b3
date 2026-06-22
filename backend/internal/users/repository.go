package users

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

var ErrUserNotFound = errors.New("user not found")

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetByEmail(ctx context.Context, email string) (*User, error) {
	const query = `
		SELECT id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
		FROM users
		WHERE email = $1
		LIMIT 1
	`

	var user User

	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.FirstName,
		&user.LastName,
		&user.Role,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("get user by email: %w", err)
	}

	return &user, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (*User, error) {
	const query = `
		SELECT id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
		FROM users
		WHERE id = $1
		LIMIT 1
	`

	var user User

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.FirstName,
		&user.LastName,
		&user.Role,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("get user by id: %w", err)
	}

	return &user, nil
}

func (r *Repository) List(ctx context.Context) ([]User, error) {
	const query = `
		SELECT id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
		FROM users
		ORDER BY id ASC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.PasswordHash,
			&user.FirstName,
			&user.LastName,
			&user.Role,
			&user.IsActive,
			&user.CreatedAt,
			&user.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users: %w", err)
	}

	return users, nil
}

func (r *Repository) Create(ctx context.Context, user *User) (int64, error) {
	const query = `
		INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`

	var id int64
	err := r.db.QueryRowContext(
		ctx,
		query,
		user.Email,
		user.PasswordHash,
		user.FirstName,
		user.LastName,
		user.Role,
		user.IsActive,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("create user: %w", err)
	}

	return id, nil
}

func (r *Repository) Update(ctx context.Context, user *User, passwordHash *string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin update user tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	const updateUserQuery = `
		UPDATE users
		SET
			email = $1,
			first_name = $2,
			last_name = $3,
			role = $4,
			is_active = $5,
			updated_at = NOW()
		WHERE id = $6
	`

	res, err := tx.ExecContext(
		ctx,
		updateUserQuery,
		user.Email,
		user.FirstName,
		user.LastName,
		user.Role,
		user.IsActive,
		user.ID,
	)
	if err != nil {
		return fmt.Errorf("update user: %w", err)
	}

	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("update user rows affected: %w", err)
	}
	if n == 0 {
		return ErrUserNotFound
	}

	if passwordHash != nil {
		const updatePasswordQuery = `
			UPDATE users
			SET password_hash = $1, updated_at = NOW()
			WHERE id = $2
		`

		res, err := tx.ExecContext(ctx, updatePasswordQuery, *passwordHash, user.ID)
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
		UPDATE users
		SET password_hash = $1, updated_at = NOW()
		WHERE id = $2
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
		DELETE FROM users
		WHERE id = $1
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

	res, err := tx.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
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

func updateUserInTx(ctx context.Context, tx *sql.Tx, user *User, passwordHash *string) error {
	const updateUserQuery = `
		UPDATE users
		SET
			email = $1,
			first_name = $2,
			last_name = $3,
			role = $4,
			is_active = $5,
			updated_at = NOW()
		WHERE id = $6
	`

	res, err := tx.ExecContext(
		ctx,
		updateUserQuery,
		user.Email,
		user.FirstName,
		user.LastName,
		user.Role,
		user.IsActive,
		user.ID,
	)
	if err != nil {
		return fmt.Errorf("update user: %w", err)
	}

	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("update user rows affected: %w", err)
	}
	if n == 0 {
		return ErrUserNotFound
	}

	if passwordHash == nil {
		return nil
	}

	const updatePasswordQuery = `
		UPDATE users
		SET password_hash = $1, updated_at = NOW()
		WHERE id = $2
	`

	res, err = tx.ExecContext(ctx, updatePasswordQuery, *passwordHash, user.ID)
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
	const query = `
		SELECT id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
		FROM users
		WHERE id = $1
		FOR UPDATE
	`

	var user User
	err := tx.QueryRowContext(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.FirstName,
		&user.LastName,
		&user.Role,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("get user by id for update: %w", err)
	}

	return &user, nil
}

func lockActiveAdminRows(ctx context.Context, tx *sql.Tx) (int, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT id
		FROM users
		WHERE role = 'admin'
		  AND is_active = TRUE
		ORDER BY id
		FOR UPDATE
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
