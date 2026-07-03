package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"mappening/internal/cache"

	"github.com/rs/zerolog/log"
)

var (
	ErrEventNotFound          = errors.New("event not found")
	ErrCategoryNotFound       = errors.New("event category not found")
	ErrOrganizationNotFound   = errors.New("organization not found")
	ErrOrganizationInactive   = errors.New("organization is inactive")
	ErrOrganizationUnverified = errors.New("organization is not verified")
	ErrForbidden              = errors.New("user cannot manage this organization")
	ErrFavoriteNotFound       = errors.New("favorite not found")
	ErrHistoryNotFound        = errors.New("history not found")
)

type Repository struct {
	db *sql.DB
	cache *cache.Client
}

func NewRepository(db *sql.DB, cache *cache.Client) *Repository {
	return &Repository{
		db: db,
		cache: cache,
	
	}
}

const eventSelect = `
	SELECT
		e.id,
		e.organization_id,
		e.title,
		e.description,
		e.start_date,
		e.end_date,
		e.latitude,
		e.longitude,
		e.address,
		e.city,
		e.postal_code,
		e.image,
		e.price,
		e.ticketing_link,
		e.source,
		e.is_active,
		e.suspended_until,
		e.suspension_reason,
		e.created_at,
		e.updated_at,
		e.deleted_at,
		o.name,
		o.is_active,
		o.latitude,
		o.longitude,
		COALESCE(string_agg(DISTINCT ec.slug, ',' ORDER BY ec.slug), '') AS category_slugs,
		COUNT(DISTINCT f.id) FILTER (WHERE f.deleted_at IS NULL) AS favorite_count,
		COUNT(DISTINCT h.id) FILTER (WHERE h.deleted_at IS NULL) AS history_count
	FROM events e
	JOIN organizations o ON o.id = e.organization_id
	LEFT JOIN event_categories_links ecl ON ecl.event_id = e.id
	LEFT JOIN event_categories ec ON ec.id = ecl.event_category_id
	LEFT JOIN favorites f ON f.event_id = e.id
	LEFT JOIN histories h ON h.event_id = e.id
`

const eventGroupBy = `
	GROUP BY
		e.id,
		o.id
`

func scanEvent(scanner interface {
	Scan(dest ...any) error
}) (*Event, error) {
	var event Event
	var latitude sql.NullFloat64
	var longitude sql.NullFloat64
	var source sql.NullString
	var suspendedUntil sql.NullTime
	var suspensionReason sql.NullString
	var deletedAt sql.NullTime
	var organizationName string
	var organizationActive bool
	var organizationLatitude sql.NullFloat64
	var organizationLongitude sql.NullFloat64
	var categorySlugs string

	err := scanner.Scan(
		&event.ID,
		&event.OrganizationID,
		&event.Title,
		&event.Description,
		&event.StartDate,
		&event.EndDate,
		&latitude,
		&longitude,
		&event.Address,
		&event.City,
		&event.PostalCode,
		&event.Image,
		&event.Price,
		&event.TicketingLink,
		&source,
		&event.IsActive,
		&suspendedUntil,
		&suspensionReason,
		&event.CreatedAt,
		&event.UpdatedAt,
		&deletedAt,
		&organizationName,
		&organizationActive,
		&organizationLatitude,
		&organizationLongitude,
		&categorySlugs,
		&event.FavoriteCount,
		&event.HistoryCount,
	)
	if err != nil {
		return nil, err
	}

	event.Latitude = nullableFloatPtr(latitude)
	event.Longitude = nullableFloatPtr(longitude)
	event.Source = nullableStringPtr(source)
	if suspendedUntil.Valid {
		event.SuspendedUntil = &suspendedUntil.Time
	}
	event.SuspensionReason = nullableStringPtr(suspensionReason)
	if deletedAt.Valid {
		event.DeletedAt = &deletedAt.Time
	}
	event.CategorySlugs = splitCSV(categorySlugs)
	event.Organization = &OrganizationSummary{
		ID:        event.OrganizationID,
		Name:      organizationName,
		IsActive:  organizationActive,
		Latitude:  nullableFloatPtr(organizationLatitude),
		Longitude: nullableFloatPtr(organizationLongitude),
	}

	return &event, nil
}

func (r *Repository) List(ctx context.Context, filters ListFilters) ([]Event, error) {
	key := "events:list:" + filters.CacheKey()
	if r.cache != nil {
		if cached, err := r.cache.Get(ctx, key).Result(); err == nil {
			var events []Event
			if json.Unmarshal([]byte(cached), &events) == nil {
				return events, nil
			}
		}
	}
	where, args := buildEventWhere(filters)
	query := eventSelect + where + eventGroupBy + buildEventHaving(filters) + buildEventOrder(filters.Sort) + buildLimitOffset(filters, len(args))
	args = appendPaginationArgs(args, filters)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list events: %w", err)
	}
	defer rows.Close()

	events := []Event{}
	for rows.Next() {
		event, err := scanEvent(rows)
		if err != nil {
			return nil, fmt.Errorf("scan event: %w", err)
		}
		events = append(events, *event)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate events: %w", err)
	}
	if r.cache != nil {
		if b, err := json.Marshal(events); err == nil {
			_ = r.cache.Set(ctx, key, b, 5*time.Minute).Err()
		}
	}

	return events, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64, includeInactive bool) (*Event, error) {
	key := fmt.Sprintf("events:byid:%d", id)

	if r.cache != nil {
		if cached, err := r.cache.Get(ctx, key).Result(); err == nil {
			var event Event
			if json.Unmarshal([]byte(cached), &event) == nil {
				return &event, nil
			}
		}
	}
	filters := ListFilters{IncludeInactive: includeInactive}
	where, args := buildEventWhere(filters)
	query := eventSelect + where + " AND e.id = $" + strconv.Itoa(len(args)+1) + eventGroupBy + " LIMIT 1"
	args = append(args, id)

	event, err := scanEvent(r.db.QueryRowContext(ctx, query, args...))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrEventNotFound
		}
		return nil, fmt.Errorf("get event: %w", err)
	}
	if r.cache != nil {
		if b, err := json.Marshal(event); err == nil {
			_ = r.cache.Set(ctx, key, b, 10*time.Minute).Err()
		}
	}
	log.Info().Msg("DB HIT: GetByID")

	return event, nil
}

func (r *Repository) Create(ctx context.Context, input EventInput, accountID int64, role string) (*Event, error) {
	if err := r.ensureCanManageOrganization(ctx, accountID, role, input.OrganizationID); err != nil {
		return nil, err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin create event tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var eventID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO events (
			organization_id,
			title,
			description,
			start_date,
			end_date,
			latitude,
			longitude,
			address,
			city,
			postal_code,
			image,
			price,
			ticketing_link,
			source,
			is_active
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id
	`,
		input.OrganizationID,
		input.Title,
		input.Description,
		input.StartDate,
		input.EndDate,
		nullFloat(input.Latitude),
		nullFloat(input.Longitude),
		input.Address,
		input.City,
		input.PostalCode,
		input.Image,
		input.Price,
		input.TicketingLink,
		nullString(input.Source),
		boolDefault(input.IsActive, false),
	).Scan(&eventID)
	if err != nil {
		return nil, fmt.Errorf("create event: %w", err)
	}

	if err := r.replaceCategoriesInTx(ctx, tx, eventID, input.CategoryIDs, input.CategorySlugs); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit create event tx: %w", err)
	}

	if r.cache != nil {
		iter := r.cache.Scan(ctx, 0, "events:list:*", 0).Iterator()
		for iter.Next(ctx) {
			_ = r.cache.Del(ctx, iter.Val()).Err()
		}
	}
	return r.GetByID(ctx, eventID, true)
}

func (r *Repository) Update(ctx context.Context, eventID int64, input EventInput, accountID int64, role string) (*Event, error) {
	current, err := r.GetByID(ctx, eventID, true)
	if err != nil {
		return nil, err
	}
	if err := r.ensureCanManageOrganization(ctx, accountID, role, current.OrganizationID); err != nil {
		return nil, err
	}
	if input.OrganizationID != current.OrganizationID {
		if err := r.ensureCanManageOrganization(ctx, accountID, role, input.OrganizationID); err != nil {
			return nil, err
		}
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin update event tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	res, err := tx.ExecContext(ctx, `
		UPDATE events
		SET
			organization_id = $1,
			title = $2,
			description = $3,
			start_date = $4,
			end_date = $5,
			latitude = $6,
			longitude = $7,
			address = $8,
			city = $9,
			postal_code = $10,
			image = $11,
			price = $12,
			ticketing_link = $13,
			source = $14,
			is_active = $15,
			updated_at = NOW()
		WHERE id = $16
		  AND deleted_at IS NULL
	`,
		input.OrganizationID,
		input.Title,
		input.Description,
		input.StartDate,
		input.EndDate,
		nullFloat(input.Latitude),
		nullFloat(input.Longitude),
		input.Address,
		input.City,
		input.PostalCode,
		input.Image,
		input.Price,
		input.TicketingLink,
		nullString(input.Source),
		boolDefault(input.IsActive, current.IsActive),
		eventID,
	)
	if err != nil {
		return nil, fmt.Errorf("update event: %w", err)
	}
	if err := requireRows(res, ErrEventNotFound); err != nil {
		return nil, err
	}

	if err := r.replaceCategoriesInTx(ctx, tx, eventID, input.CategoryIDs, input.CategorySlugs); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit update event tx: %w", err)
	}
	if r.cache != nil {
	_ = r.cache.Del(ctx, fmt.Sprintf("events:byid:%d", eventID)).Err()

	iter := r.cache.Scan(ctx, 0, "events:list:*", 0).Iterator()
	for iter.Next(ctx) {
		_ = r.cache.Del(ctx, iter.Val()).Err()
	}
}

	return r.GetByID(ctx, eventID, true)
}

func (r *Repository) Delete(ctx context.Context, eventID int64, accountID int64, role string) error {
	event, err := r.GetByID(ctx, eventID, true)
	if err != nil {
		return err
	}
	if err := r.ensureCanManageOrganization(ctx, accountID, role, event.OrganizationID); err != nil {
		return err
	}

	res, err := r.db.ExecContext(ctx, `
		UPDATE events
		SET deleted_at = COALESCE(deleted_at, NOW()),
		    is_active = FALSE,
		    updated_at = NOW()
		WHERE id = $1
		  AND deleted_at IS NULL
	`, eventID)
	if err != nil {
		return fmt.Errorf("delete event: %w", err)
	}
	if r.cache != nil {
		_ = r.cache.Del(ctx, fmt.Sprintf("events:byid:%d", eventID)).Err()

		keys, err := r.cache.Keys(ctx, "events:list:*").Result()
		if err == nil && len(keys) > 0 {
			_ = r.cache.Del(ctx, keys...).Err()
		}
	}
	return requireRows(res, ErrEventNotFound)
	
}

func (r *Repository) SetActive(ctx context.Context, eventID int64, active bool, accountID int64, role string) (*Event, error) {
	event, err := r.GetByID(ctx, eventID, true)
	if err != nil {
		return nil, err
	}
	if err := r.ensureCanManageOrganization(ctx, accountID, role, event.OrganizationID); err != nil {
		return nil, err
	}

	res, err := r.db.ExecContext(ctx, `
		UPDATE events
		SET is_active = $1,
		    updated_at = NOW()
		WHERE id = $2
		  AND deleted_at IS NULL
	`, active, eventID)
	if err != nil {
		return nil, fmt.Errorf("set event active: %w", err)
	}
	if err := requireRows(res, ErrEventNotFound); err != nil {
		return nil, err
	}
		if r.cache != nil {
		_ = r.cache.Del(ctx, fmt.Sprintf("events:byid:%d", eventID)).Err()

		keys, err := r.cache.Keys(ctx, "events:list:*").Result()
		if err == nil && len(keys) > 0 {
			_ = r.cache.Del(ctx, keys...).Err()
		}
	}

	return r.GetByID(ctx, eventID, true)
}

func (r *Repository) ListCategories(ctx context.Context) ([]Category, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, slug
		FROM event_categories
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list event categories: %w", err)
	}
	defer rows.Close()

	categories := []Category{}
	for rows.Next() {
		var category Category
		if err := rows.Scan(&category.ID, &category.Name, &category.Slug); err != nil {
			return nil, fmt.Errorf("scan event category: %w", err)
		}
		categories = append(categories, category)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate event categories: %w", err)
	}

	return categories, nil
}

func (r *Repository) GetCategory(ctx context.Context, id int64) (*Category, error) {
	var category Category
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, slug
		FROM event_categories
		WHERE id = $1
	`, id).Scan(&category.ID, &category.Name, &category.Slug)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCategoryNotFound
		}
		return nil, fmt.Errorf("get event category: %w", err)
	}

	return &category, nil
}

func (r *Repository) ReplaceCategories(ctx context.Context, eventID int64, categoryIDs []int64, categorySlugs []string, accountID int64, role string) (*Event, error) {
	event, err := r.GetByID(ctx, eventID, true)
	if err != nil {
		return nil, err
	}
	if err := r.ensureCanManageOrganization(ctx, accountID, role, event.OrganizationID); err != nil {
		return nil, err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin replace event categories tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if err := r.replaceCategoriesInTx(ctx, tx, eventID, categoryIDs, categorySlugs); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit replace event categories tx: %w", err)
	}

	return r.GetByID(ctx, eventID, true)
}

func (r *Repository) AddCategory(ctx context.Context, eventID int64, categoryID int64, accountID int64, role string) (*Event, error) {
	event, err := r.GetByID(ctx, eventID, true)
	if err != nil {
		return nil, err
	}
	if err := r.ensureCanManageOrganization(ctx, accountID, role, event.OrganizationID); err != nil {
		return nil, err
	}
	if _, err := r.GetCategory(ctx, categoryID); err != nil {
		return nil, err
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO event_categories_links (event_id, event_category_id)
		VALUES ($1, $2)
		ON CONFLICT (event_id, event_category_id) DO NOTHING
	`, eventID, categoryID)
	if err != nil {
		return nil, fmt.Errorf("add event category: %w", err)
	}

	return r.GetByID(ctx, eventID, true)
}

func (r *Repository) RemoveCategory(ctx context.Context, eventID int64, categoryID int64, accountID int64, role string) (*Event, error) {
	event, err := r.GetByID(ctx, eventID, true)
	if err != nil {
		return nil, err
	}
	if err := r.ensureCanManageOrganization(ctx, accountID, role, event.OrganizationID); err != nil {
		return nil, err
	}

	res, err := r.db.ExecContext(ctx, `
		DELETE FROM event_categories_links
		WHERE event_id = $1
		  AND event_category_id = $2
	`, eventID, categoryID)
	if err != nil {
		return nil, fmt.Errorf("remove event category: %w", err)
	}
	if err := requireRows(res, ErrCategoryNotFound); err != nil {
		return nil, err
	}

	return r.GetByID(ctx, eventID, true)
}

func (r *Repository) AddFavorite(ctx context.Context, accountID int64, eventID int64) (*Favorite, error) {
	userID, err := r.userProfileID(ctx, accountID)
	if err != nil {
		return nil, err
	}
	if _, err := r.GetByID(ctx, eventID, false); err != nil {
		return nil, err
	}

	var favorite Favorite
	err = r.db.QueryRowContext(ctx, `
		INSERT INTO favorites (user_id, event_id, deleted_at)
		VALUES ($1, $2, NULL)
		ON CONFLICT (user_id, event_id)
		DO UPDATE SET deleted_at = NULL, created_at = NOW()
		RETURNING id, user_id, event_id, created_at, deleted_at
	`, userID, eventID).Scan(
		&favorite.ID,
		&favorite.UserID,
		&favorite.EventID,
		&favorite.CreatedAt,
		&favorite.DeletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("add favorite: %w", err)
	}

	return &favorite, nil
}

func (r *Repository) RemoveFavorite(ctx context.Context, accountID int64, eventID int64) error {
	userID, err := r.userProfileID(ctx, accountID)
	if err != nil {
		return err
	}

	res, err := r.db.ExecContext(ctx, `
		UPDATE favorites
		SET deleted_at = COALESCE(deleted_at, NOW())
		WHERE user_id = $1
		  AND event_id = $2
		  AND deleted_at IS NULL
	`, userID, eventID)
	if err != nil {
		return fmt.Errorf("remove favorite: %w", err)
	}

	return requireRows(res, ErrFavoriteNotFound)
}

func (r *Repository) IsFavorite(ctx context.Context, accountID int64, eventID int64) (bool, error) {
	userID, err := r.userProfileID(ctx, accountID)
	if err != nil {
		return false, err
	}

	var exists bool
	err = r.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM favorites
			WHERE user_id = $1
			  AND event_id = $2
			  AND deleted_at IS NULL
		)
	`, userID, eventID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check favorite: %w", err)
	}

	return exists, nil
}

func (r *Repository) ListFavorites(ctx context.Context, accountID int64) ([]Favorite, error) {
	userID, err := r.userProfileID(ctx, accountID)
	if err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, event_id, created_at, deleted_at
		FROM favorites
		WHERE user_id = $1
		  AND deleted_at IS NULL
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list favorites: %w", err)
	}
	defer rows.Close()

	favorites := []Favorite{}
	for rows.Next() {
		var favorite Favorite
		if err := rows.Scan(&favorite.ID, &favorite.UserID, &favorite.EventID, &favorite.CreatedAt, &favorite.DeletedAt); err != nil {
			return nil, fmt.Errorf("scan favorite: %w", err)
		}
		favorites = append(favorites, favorite)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate favorites: %w", err)
	}

	return favorites, nil
}

func (r *Repository) RecordHistory(ctx context.Context, accountID int64, eventID int64) (*History, error) {
	userID, err := r.userProfileID(ctx, accountID)
	if err != nil {
		return nil, err
	}
	if _, err := r.GetByID(ctx, eventID, false); err != nil {
		return nil, err
	}

	var history History
	err = r.db.QueryRowContext(ctx, `
		WITH updated AS (
			UPDATE histories
			SET visited_at = NOW(), deleted_at = NULL
			WHERE id = (
				SELECT id
				FROM histories
				WHERE user_id = $1
				  AND event_id = $2
				ORDER BY visited_at DESC
				LIMIT 1
			)
			RETURNING id, user_id, event_id, visited_at, deleted_at
		),
		inserted AS (
			INSERT INTO histories (user_id, event_id)
			SELECT $1, $2
			WHERE NOT EXISTS (SELECT 1 FROM updated)
			RETURNING id, user_id, event_id, visited_at, deleted_at
		)
		SELECT id, user_id, event_id, visited_at, deleted_at FROM updated
		UNION ALL
		SELECT id, user_id, event_id, visited_at, deleted_at FROM inserted
		LIMIT 1
	`, userID, eventID).Scan(
		&history.ID,
		&history.UserID,
		&history.EventID,
		&history.VisitedAt,
		&history.DeletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("record history: %w", err)
	}

	return &history, nil
}

func (r *Repository) ListHistory(ctx context.Context, accountID int64) ([]History, error) {
	userID, err := r.userProfileID(ctx, accountID)
	if err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, event_id, visited_at, deleted_at
		FROM histories
		WHERE user_id = $1
		  AND deleted_at IS NULL
		ORDER BY visited_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list history: %w", err)
	}
	defer rows.Close()

	histories := []History{}
	for rows.Next() {
		var history History
		if err := rows.Scan(&history.ID, &history.UserID, &history.EventID, &history.VisitedAt, &history.DeletedAt); err != nil {
			return nil, fmt.Errorf("scan history: %w", err)
		}
		histories = append(histories, history)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate history: %w", err)
	}

	return histories, nil
}

func (r *Repository) RemoveHistory(ctx context.Context, accountID int64, historyID int64) error {
	userID, err := r.userProfileID(ctx, accountID)
	if err != nil {
		return err
	}

	res, err := r.db.ExecContext(ctx, `
		UPDATE histories
		SET deleted_at = COALESCE(deleted_at, NOW())
		WHERE id = $1
		  AND user_id = $2
		  AND deleted_at IS NULL
	`, historyID, userID)
	if err != nil {
		return fmt.Errorf("remove history: %w", err)
	}

	return requireRows(res, ErrHistoryNotFound)
}

func (r *Repository) ensureCanManageOrganization(ctx context.Context, accountID int64, role string, organizationID int64) error {
	var ownerAccountID int64
	var active bool
	var verified bool
	var deletedAt sql.NullTime
	err := r.db.QueryRowContext(ctx, `
		SELECT account_id, is_active, is_verified, deleted_at
		FROM organizations
		WHERE id = $1
	`, organizationID).Scan(&ownerAccountID, &active, &verified, &deletedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrOrganizationNotFound
		}
		return fmt.Errorf("get organization state: %w", err)
	}
	if !active || deletedAt.Valid {
		return ErrOrganizationInactive
	}
	if !verified {
		return ErrOrganizationUnverified
	}
	if strings.EqualFold(role, "admin") || ownerAccountID == accountID {
		return nil
	}

	userID, err := r.userProfileID(ctx, accountID)
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
		return fmt.Errorf("check organization membership: %w", err)
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
		if errors.Is(err, sql.ErrNoRows) {
			return 0, ErrForbidden
		}
		return 0, fmt.Errorf("get user profile id: %w", err)
	}

	return userID, nil
}

func (r *Repository) replaceCategoriesInTx(ctx context.Context, tx *sql.Tx, eventID int64, categoryIDs []int64, categorySlugs []string) error {
	categoryIDs, err := r.resolveCategoryIDs(ctx, tx, categoryIDs, categorySlugs)
	if err != nil {
		return err
	}
	if len(categoryIDs) == 0 {
		return errors.New("at least one event category is required")
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM event_categories_links WHERE event_id = $1`, eventID); err != nil {
		return fmt.Errorf("clear event categories: %w", err)
	}

	for _, categoryID := range categoryIDs {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO event_categories_links (event_id, event_category_id)
			VALUES ($1, $2)
		`, eventID, categoryID); err != nil {
			return fmt.Errorf("insert event category link: %w", err)
		}
	}

	return nil
}

func (r *Repository) resolveCategoryIDs(ctx context.Context, tx *sql.Tx, ids []int64, slugs []string) ([]int64, error) {
	unique := map[int64]struct{}{}
	for _, id := range ids {
		if id > 0 {
			unique[id] = struct{}{}
		}
	}

	normalizedSlugs := make([]string, 0, len(slugs))
	for _, slug := range slugs {
		slug = strings.TrimSpace(strings.ToLower(slug))
		if slug != "" {
			normalizedSlugs = append(normalizedSlugs, slug)
		}
	}

	if len(normalizedSlugs) > 0 {
		placeholders := makePlaceholders(1, len(normalizedSlugs))
		args := make([]any, 0, len(normalizedSlugs))
		for _, slug := range normalizedSlugs {
			args = append(args, slug)
		}

		rows, err := tx.QueryContext(ctx, `
			SELECT id
			FROM event_categories
			WHERE slug IN (`+strings.Join(placeholders, ", ")+`)
		`, args...)
		if err != nil {
			return nil, fmt.Errorf("resolve event categories by slug: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				return nil, fmt.Errorf("scan category id: %w", err)
			}
			unique[id] = struct{}{}
		}
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("iterate category ids: %w", err)
		}
	}

	resolved := make([]int64, 0, len(unique))
	for id := range unique {
		resolved = append(resolved, id)
	}
	if len(resolved) == 0 {
		return nil, nil
	}

	placeholders := makePlaceholders(1, len(resolved))
	args := make([]any, 0, len(resolved))
	for _, id := range resolved {
		args = append(args, id)
	}

	var found int
	err := tx.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM event_categories
		WHERE id IN (`+strings.Join(placeholders, ", ")+`)
	`, args...).Scan(&found)
	if err != nil {
		return nil, fmt.Errorf("validate event categories: %w", err)
	}
	if found != len(resolved) {
		return nil, ErrCategoryNotFound
	}

	return resolved, nil
}

func buildEventWhere(filters ListFilters) (string, []any) {
	clauses := []string{"e.deleted_at IS NULL", "o.deleted_at IS NULL"}
	args := []any{}

	if filters.IncludeDeleted {
		clauses = []string{"1 = 1"}
	} else {
		clauses = []string{"e.deleted_at IS NULL", "o.deleted_at IS NULL"}
	}

	if !filters.IncludeInactive {
		clauses = append(clauses, "e.is_active = TRUE", "o.is_active = TRUE")
	}
	if filters.Query != "" {
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(filters.Query))+"%")
		clauses = append(clauses, "(LOWER(e.title) LIKE $"+strconv.Itoa(len(args))+" OR LOWER(e.description) LIKE $"+strconv.Itoa(len(args))+" OR LOWER(o.name) LIKE $"+strconv.Itoa(len(args))+")")
	}
	if filters.City != "" {
		args = append(args, strings.ToLower(strings.TrimSpace(filters.City)))
		clauses = append(clauses, "LOWER(e.city) = $"+strconv.Itoa(len(args)))
	}
	if filters.PostalCode != "" {
		args = append(args, strings.TrimSpace(filters.PostalCode))
		clauses = append(clauses, "e.postal_code = $"+strconv.Itoa(len(args)))
	}
	if filters.OrganizationID != nil {
		args = append(args, *filters.OrganizationID)
		clauses = append(clauses, "e.organization_id = $"+strconv.Itoa(len(args)))
	}
	if filters.Date != nil {
		args = append(args, *filters.Date)
		clauses = append(clauses, "DATE(e.start_date) = DATE($"+strconv.Itoa(len(args))+")")
	}
	if filters.DateFrom != nil {
		args = append(args, *filters.DateFrom)
		clauses = append(clauses, "e.end_date >= $"+strconv.Itoa(len(args)))
	}
	if filters.DateTo != nil {
		args = append(args, *filters.DateTo)
		clauses = append(clauses, "e.start_date <= $"+strconv.Itoa(len(args)))
	}
	if filters.PriceMin != nil {
		args = append(args, *filters.PriceMin)
		clauses = append(clauses, "e.price >= $"+strconv.Itoa(len(args)))
	}
	if filters.PriceMax != nil {
		args = append(args, *filters.PriceMax)
		clauses = append(clauses, "e.price <= $"+strconv.Itoa(len(args)))
	}
	if filters.FreeOnly {
		clauses = append(clauses, "e.price = 0")
	}
	if filters.PaidOnly {
		clauses = append(clauses, "e.price > 0")
	}
	if filters.UpcomingOnly {
		clauses = append(clauses, "e.end_date >= NOW()")
	}
	if filters.PastOnly {
		clauses = append(clauses, "e.end_date < NOW()")
	}
	if filters.Bounds != nil {
		args = append(args, filters.Bounds.South)
		southIndex := len(args)
		args = append(args, filters.Bounds.North)
		northIndex := len(args)
		args = append(args, filters.Bounds.West)
		westIndex := len(args)
		args = append(args, filters.Bounds.East)
		eastIndex := len(args)
		clauses = append(clauses,
			"e.latitude IS NOT NULL",
			"e.longitude IS NOT NULL",
			"e.latitude BETWEEN $"+strconv.Itoa(southIndex)+" AND $"+strconv.Itoa(northIndex),
			"e.longitude BETWEEN $"+strconv.Itoa(westIndex)+" AND $"+strconv.Itoa(eastIndex),
		)
	}

	return " WHERE " + strings.Join(clauses, " AND "), args
}

func buildEventHaving(filters ListFilters) string {
	slugs := make([]string, 0, len(filters.CategorySlugs))
	for _, slug := range filters.CategorySlugs {
		slug = strings.TrimSpace(strings.ToLower(slug))
		if slug != "" {
			slugs = append(slugs, slug)
		}
	}
	if len(slugs) == 0 {
		return ""
	}

	quoted := make([]string, 0, len(slugs))
	for _, slug := range slugs {
		quoted = append(quoted, "'"+strings.ReplaceAll(slug, "'", "''")+"'")
	}

	return " HAVING ARRAY_AGG(DISTINCT ec.slug) && ARRAY[" + strings.Join(quoted, ", ") + "]::text[]"
}

func buildEventOrder(sort string) string {
	switch strings.TrimSpace(strings.ToLower(sort)) {
	case "oldest", "created-asc":
		return " ORDER BY e.created_at ASC"
	case "date-desc":
		return " ORDER BY e.start_date DESC"
	case "price-asc":
		return " ORDER BY e.price ASC, e.start_date ASC"
	case "price-desc":
		return " ORDER BY e.price DESC, e.start_date ASC"
	case "popular", "popularity-desc":
		return " ORDER BY favorite_count DESC, history_count DESC, e.start_date ASC"
	case "date-asc", "":
		return " ORDER BY e.start_date ASC"
	default:
		return " ORDER BY e.created_at DESC"
	}
}

func buildLimitOffset(filters ListFilters, argsCount int) string {
	parts := []string{}
	if filters.Limit > 0 {
		parts = append(parts, " LIMIT $"+strconv.Itoa(argsCount+len(parts)+1))
	}
	if filters.Offset > 0 {
		parts = append(parts, " OFFSET $"+strconv.Itoa(argsCount+len(parts)+1))
	}
	return strings.Join(parts, "")
}

func appendPaginationArgs(args []any, filters ListFilters) []any {
	if filters.Limit > 0 {
		args = append(args, filters.Limit)
	}
	if filters.Offset > 0 {
		args = append(args, filters.Offset)
	}
	return args
}

func (f ListFilters) CacheKey() string {
	return fmt.Sprintf(
		"%d:%d:%s:%t:%s:%s:%t:%t",
		f.Limit,
		f.Offset,
		f.Sort,
		f.IncludeInactive,
		f.City,
		f.Query,
		f.FreeOnly,
		f.UpcomingOnly,
	)
}

func makePlaceholders(start int, count int) []string {
	placeholders := make([]string, count)
	for i := 0; i < count; i++ {
		placeholders[i] = "$" + strconv.Itoa(start+i)
	}
	return placeholders
}

func requireRows(res sql.Result, notFound error) error {
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if n == 0 {
		return notFound
	}
	return nil
}

func nullableFloatPtr(value sql.NullFloat64) *float64 {
	if !value.Valid {
		return nil
	}
	return &value.Float64
}

func nullableStringPtr(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func nullFloat(value *float64) sql.NullFloat64 {
	if value == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *value, Valid: true}
}

func nullString(value *string) sql.NullString {
	if value == nil || strings.TrimSpace(*value) == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: strings.TrimSpace(*value), Valid: true}
}

func boolDefault(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func splitCSV(value string) []string {
	if strings.TrimSpace(value) == "" {
		return []string{}
	}

	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}
