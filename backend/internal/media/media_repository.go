package media

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

var (
	ErrMediaNotFound        = errors.New("media not found")
	ErrTargetNotFound       = errors.New("media target not found")
	ErrForbidden            = errors.New("user cannot manage this media")
	ErrUnsupportedEntity    = errors.New("unsupported media entity type")
	ErrOrganizationInactive = errors.New("organization is inactive")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, media Media) (*Media, error) {
	return scanMedia(r.db.QueryRowContext(ctx, insertMediaQuery,
		nullInt(media.OwnerAccountID),
		media.EntityType,
		nullInt(media.EntityID),
		media.FileName,
		media.FilePath,
		media.PublicURL,
		media.MimeType,
		media.SizeBytes,
	))
}

func (r *Repository) GetByID(ctx context.Context, mediaID int64) (*Media, error) {
	media, err := scanMedia(r.db.QueryRowContext(ctx, selectMediaByIDQuery, mediaID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrMediaNotFound
		}
		return nil, fmt.Errorf("get media: %w", err)
	}
	return media, nil
}

func (r *Repository) SoftDelete(ctx context.Context, mediaID int64) error {
	res, err := r.db.ExecContext(ctx, softDeleteMediaQuery, mediaID)
	if err != nil {
		return fmt.Errorf("soft delete media: %w", err)
	}
	return requireRows(res, ErrMediaNotFound)
}

func (r *Repository) SoftDeleteActiveForEntity(ctx context.Context, entityType string, entityID int64) error {
	_, err := r.db.ExecContext(ctx, softDeleteActiveEntityMediaQuery, entityType, entityID)
	if err != nil {
		return fmt.Errorf("soft delete previous entity media: %w", err)
	}
	return nil
}

func (r *Repository) SetOrganizationLogo(ctx context.Context, organizationID int64, url string) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE organizations
		SET logo = $1,
		    updated_at = NOW()
		WHERE id = $2
		  AND deleted_at IS NULL
	`, nullString(url), organizationID)
	if err != nil {
		return fmt.Errorf("set organization logo: %w", err)
	}
	return requireRows(res, ErrTargetNotFound)
}

func (r *Repository) SetEventImage(ctx context.Context, eventID int64, url string) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE events
		SET image = $1,
		    updated_at = NOW()
		WHERE id = $2
		  AND deleted_at IS NULL
	`, url, eventID)
	if err != nil {
		return fmt.Errorf("set event image: %w", err)
	}
	return requireRows(res, ErrTargetNotFound)
}

func (r *Repository) ClearLinkedURL(ctx context.Context, media *Media) error {
	if media == nil || media.EntityID == nil {
		return nil
	}

	switch media.EntityType {
	case "organization":
		_, err := r.db.ExecContext(ctx, `
			UPDATE organizations
			SET logo = NULL,
			    updated_at = NOW()
			WHERE id = $1
			  AND logo = $2
		`, *media.EntityID, media.PublicURL)
		if err != nil {
			return fmt.Errorf("clear organization logo: %w", err)
		}
	case "event":
		_, err := r.db.ExecContext(ctx, `
			UPDATE events
			SET image = '',
			    updated_at = NOW()
			WHERE id = $1
			  AND image = $2
		`, *media.EntityID, media.PublicURL)
		if err != nil {
			return fmt.Errorf("clear event image: %w", err)
		}
	}
	return nil
}

func (r *Repository) CanManageOrganization(ctx context.Context, actor Actor, organizationID int64, requireActive bool) error {
	var ownerAccountID int64
	var active bool
	var deletedAt sql.NullTime
	err := r.db.QueryRowContext(ctx, `
		SELECT account_id, is_active, deleted_at
		FROM organizations
		WHERE id = $1
	`, organizationID).Scan(&ownerAccountID, &active, &deletedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrTargetNotFound
		}
		return fmt.Errorf("get organization media target: %w", err)
	}
	if deletedAt.Valid || (requireActive && !active) {
		return ErrOrganizationInactive
	}
	if isAdmin(actor.Role) || ownerAccountID == actor.AccountID {
		return nil
	}
	return ErrForbidden
}

func (r *Repository) CanManageEvent(ctx context.Context, actor Actor, eventID int64) error {
	var organizationID sql.NullInt64
	err := r.db.QueryRowContext(ctx, `
		SELECT organization_id
		FROM events
		WHERE id = $1
		  AND deleted_at IS NULL
	`, eventID).Scan(&organizationID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrTargetNotFound
		}
		return fmt.Errorf("get event media target: %w", err)
	}
	if !organizationID.Valid {
		if isAdmin(actor.Role) {
			return nil
		}
		return ErrForbidden
	}
	return r.CanManageOrganizationMembership(ctx, actor, organizationID.Int64)
}

func (r *Repository) CanManageOrganizationMembership(ctx context.Context, actor Actor, organizationID int64) error {
	var ownerAccountID int64
	var active bool
	var deletedAt sql.NullTime
	err := r.db.QueryRowContext(ctx, `
		SELECT account_id, is_active, deleted_at
		FROM organizations
		WHERE id = $1
	`, organizationID).Scan(&ownerAccountID, &active, &deletedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrTargetNotFound
		}
		return fmt.Errorf("get organization media membership target: %w", err)
	}
	if deletedAt.Valid || !active {
		return ErrOrganizationInactive
	}
	if isAdmin(actor.Role) || ownerAccountID == actor.AccountID {
		return nil
	}

	userID, err := r.userProfileID(ctx, actor.AccountID)
	if err != nil {
		return ErrForbidden
	}

	var isMember bool
	err = r.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM organizers
			WHERE user_id = $1
			  AND organization_id = $2
			  AND deleted_at IS NULL
		)
	`, userID, organizationID).Scan(&isMember)
	if err != nil {
		return fmt.Errorf("check media organization membership: %w", err)
	}
	if !isMember {
		return ErrForbidden
	}
	return nil
}

func (r *Repository) userProfileID(ctx context.Context, accountID int64) (int64, error) {
	var userID int64
	err := r.db.QueryRowContext(ctx, `
		SELECT id
		FROM users
		WHERE account_id = $1
		  AND deleted_at IS NULL
	`, accountID).Scan(&userID)
	if err != nil {
		return 0, err
	}
	return userID, nil
}

func scanMedia(scanner interface {
	Scan(dest ...any) error
}) (*Media, error) {
	var media Media
	var ownerAccountID sql.NullInt64
	var entityID sql.NullInt64
	var deletedAt sql.NullTime

	if err := scanner.Scan(
		&media.ID,
		&ownerAccountID,
		&media.EntityType,
		&entityID,
		&media.FileName,
		&media.FilePath,
		&media.PublicURL,
		&media.MimeType,
		&media.SizeBytes,
		&media.CreatedAt,
		&deletedAt,
	); err != nil {
		return nil, err
	}
	media.OwnerAccountID = nullableIntPtr(ownerAccountID)
	media.EntityID = nullableIntPtr(entityID)
	if deletedAt.Valid {
		media.DeletedAt = &deletedAt.Time
	}
	return &media, nil
}

func nullInt(value *int64) sql.NullInt64 {
	if value == nil || *value <= 0 {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: *value, Valid: true}
}

func nullableIntPtr(value sql.NullInt64) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

func nullString(value string) sql.NullString {
	value = strings.TrimSpace(value)
	return sql.NullString{String: value, Valid: value != ""}
}

func requireRows(result sql.Result, notFound error) error {
	count, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if count == 0 {
		return notFound
	}
	return nil
}

func isAdmin(role string) bool {
	return strings.EqualFold(strings.TrimSpace(role), "admin")
}
