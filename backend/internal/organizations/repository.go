package organizations

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

var (
	ErrOrganizationNotFound = errors.New("organization not found")
	ErrCategoryNotFound     = errors.New("organization category not found")
	ErrOrganizerNotFound    = errors.New("organization member not found")
	ErrForbidden            = errors.New("user cannot manage this organization")
	ErrAccountRequired      = errors.New("account_id is required")
	ErrAccountNotFound      = errors.New("account not found")
	ErrUserNotFound         = errors.New("user not found")
	ErrContactEmailUsed     = errors.New("organization contact_email already used")
	ErrAccountAlreadyUsed   = errors.New("account already has an organization")
	ErrSIRETAlreadyUsed     = errors.New("organization siret already used")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

const organizationSelect = `
	SELECT
		o.id,
		o.account_id,
		o.name,
		o.contact_email,
		o.role_id,
		o.description,
		o.website,
		o.latitude,
		o.longitude,
		o.address,
		o.city,
		o.postal_code,
		o.logo,
		o.contact_phone_number,
		o.siret,
		o.is_verified,
		o.is_active,
		o.created_at,
		o.updated_at,
		o.deleted_at,
		COALESCE(string_agg(DISTINCT oc.slug, ',' ORDER BY oc.slug), '') AS category_slugs
	FROM organizations o
	LEFT JOIN organization_categories_links ocl ON ocl.organization_id = o.id
	LEFT JOIN organization_categories oc ON oc.id = ocl.organization_category_id
`

const organizationGroupBy = `
	GROUP BY o.id
`

func scanOrganization(scanner interface {
	Scan(dest ...any) error
}) (*Organization, error) {
	var organization Organization
	var roleID sql.NullInt64
	var description sql.NullString
	var website sql.NullString
	var latitude sql.NullFloat64
	var longitude sql.NullFloat64
	var logo sql.NullString
	var phone sql.NullString
	var siret sql.NullString
	var deletedAt sql.NullTime
	var categorySlugs string

	err := scanner.Scan(
		&organization.ID,
		&organization.AccountID,
		&organization.Name,
		&organization.ContactEmail,
		&roleID,
		&description,
		&website,
		&latitude,
		&longitude,
		&organization.Address,
		&organization.City,
		&organization.PostalCode,
		&logo,
		&phone,
		&siret,
		&organization.IsVerified,
		&organization.IsActive,
		&organization.CreatedAt,
		&organization.UpdatedAt,
		&deletedAt,
		&categorySlugs,
	)
	if err != nil {
		return nil, err
	}

	if roleID.Valid {
		organization.RoleID = &roleID.Int64
	}
	organization.Description = nullableStringPtr(description)
	organization.Website = nullableStringPtr(website)
	organization.Latitude = nullableFloatPtr(latitude)
	organization.Longitude = nullableFloatPtr(longitude)
	organization.Logo = nullableStringPtr(logo)
	organization.ContactPhoneNumber = nullableStringPtr(phone)
	organization.SIRET = nullableStringPtr(siret)
	if deletedAt.Valid {
		organization.DeletedAt = &deletedAt.Time
	}
	organization.CategorySlugs = splitCSV(categorySlugs)

	return &organization, nil
}

func (r *Repository) List(ctx context.Context, filters ListFilters) ([]Organization, error) {
	where, args := buildOrganizationWhere(filters)
	query := organizationSelect + where + organizationGroupBy + " ORDER BY o.name ASC, o.id ASC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list organizations: %w", err)
	}
	defer rows.Close()

	var organizations []Organization
	for rows.Next() {
		organization, err := scanOrganization(rows)
		if err != nil {
			return nil, fmt.Errorf("scan organization: %w", err)
		}
		organizations = append(organizations, *organization)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate organizations: %w", err)
	}

	return organizations, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64, includeInactive bool, includeDeleted bool) (*Organization, error) {
	filters := ListFilters{
		IncludeInactive: includeInactive,
		IncludeDeleted:  includeDeleted,
	}
	where, args := buildOrganizationWhere(filters)
	args = append(args, id)
	query := organizationSelect + where + " AND o.id = $" + strconv.Itoa(len(args)) + organizationGroupBy + " LIMIT 1"

	organization, err := scanOrganization(r.db.QueryRowContext(ctx, query, args...))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrOrganizationNotFound
		}
		return nil, fmt.Errorf("get organization: %w", err)
	}

	return organization, nil
}

func (r *Repository) GetByAccountID(ctx context.Context, accountID int64, includeInactive bool, includeDeleted bool) (*Organization, error) {
	filters := ListFilters{
		IncludeInactive: includeInactive,
		IncludeDeleted:  includeDeleted,
		AccountID:       &accountID,
	}
	where, args := buildOrganizationWhere(filters)
	query := organizationSelect + where + organizationGroupBy + " LIMIT 1"

	organization, err := scanOrganization(r.db.QueryRowContext(ctx, query, args...))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrOrganizationNotFound
		}
		return nil, fmt.Errorf("get account organization: %w", err)
	}

	return organization, nil
}

func (r *Repository) ListByUser(ctx context.Context, userID int64, includeInactive bool, includeDeleted bool) ([]Organization, error) {
	filters := ListFilters{
		IncludeInactive: includeInactive,
		IncludeDeleted:  includeDeleted,
	}
	where, args := buildOrganizationWhere(filters)
	args = append(args, userID)
	query := organizationSelect + `
		JOIN organizers orgz ON orgz.organization_id = o.id
	` + where + `
		  AND orgz.user_id = $` + strconv.Itoa(len(args)) + `
		  AND orgz.deleted_at IS NULL
	` + organizationGroupBy + " ORDER BY o.name ASC, o.id ASC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list user organizations: %w", err)
	}
	defer rows.Close()

	var organizations []Organization
	for rows.Next() {
		organization, err := scanOrganization(rows)
		if err != nil {
			return nil, fmt.Errorf("scan user organization: %w", err)
		}
		organizations = append(organizations, *organization)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate user organizations: %w", err)
	}

	return organizations, nil
}

func (r *Repository) Create(ctx context.Context, input OrganizationInput, actorAccountID int64, actorRole string) (*Organization, error) {
	accountID, err := effectiveAccountID(input.AccountID, actorAccountID, actorRole)
	if err != nil {
		return nil, err
	}
	if err := r.ensureAccountExists(ctx, accountID); err != nil {
		return nil, err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin create organization tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var organizationID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO organizations (
			account_id,
			name,
			contact_email,
			role_id,
			description,
			website,
			latitude,
			longitude,
			address,
			city,
			postal_code,
			logo,
			contact_phone_number,
			siret,
			is_verified,
			is_active
		)
		SELECT $1, $2, $3, r.id, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
		FROM roles r
		WHERE r.slug = 'organization'
		RETURNING id
	`,
		accountID,
		input.Name,
		input.ContactEmail,
		nullString(input.Description),
		nullString(input.Website),
		nullFloat(input.Latitude),
		nullFloat(input.Longitude),
		input.Address,
		input.City,
		input.PostalCode,
		nullString(input.Logo),
		nullString(input.ContactPhoneNumber),
		nullString(input.SIRET),
		boolDefault(input.IsVerified, isAdmin(actorRole)),
		boolDefault(input.IsActive, true),
	).Scan(&organizationID)
	if err != nil {
		return nil, mapConstraintError("create organization", err)
	}

	if err := r.replaceCategoriesInTx(ctx, tx, organizationID, input.CategoryIDs, input.CategorySlugs); err != nil {
		return nil, err
	}

	if userID, err := r.userProfileID(ctx, accountID); err == nil {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO organizers (user_id, organization_id, job_role, deleted_at, updated_at)
			VALUES ($1, $2, NULL, NULL, NOW())
			ON CONFLICT (user_id, organization_id)
			DO UPDATE SET deleted_at = NULL, updated_at = NOW()
		`, userID, organizationID); err != nil {
			return nil, fmt.Errorf("create owner organizer membership: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit create organization tx: %w", err)
	}

	return r.GetByID(ctx, organizationID, true, false)
}

func (r *Repository) Update(ctx context.Context, organizationID int64, input OrganizationInput, actorAccountID int64, actorRole string) (*Organization, error) {
	current, err := r.GetByID(ctx, organizationID, true, false)
	if err != nil {
		return nil, err
	}
	if !canManageOrganizationProfile(current, actorAccountID, actorRole) {
		return nil, ErrForbidden
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin update organization tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	accountID := current.AccountID
	if input.AccountID != nil && isAdmin(actorRole) {
		accountID = *input.AccountID
		if err := r.ensureAccountExists(ctx, accountID); err != nil {
			return nil, err
		}
	}

	isVerified := current.IsVerified
	if input.IsVerified != nil && isAdmin(actorRole) {
		isVerified = *input.IsVerified
	}
	isActive := current.IsActive
	if input.IsActive != nil && isAdmin(actorRole) {
		isActive = *input.IsActive
	}

	res, err := tx.ExecContext(ctx, `
		UPDATE organizations
		SET
			account_id = $1,
			name = $2,
			contact_email = $3,
			description = $4,
			website = $5,
			latitude = $6,
			longitude = $7,
			address = $8,
			city = $9,
			postal_code = $10,
			logo = $11,
			contact_phone_number = $12,
			siret = $13,
			is_verified = $14,
			is_active = $15,
			updated_at = NOW()
		WHERE id = $16
		  AND deleted_at IS NULL
	`,
		accountID,
		input.Name,
		input.ContactEmail,
		nullString(input.Description),
		nullString(input.Website),
		nullFloat(input.Latitude),
		nullFloat(input.Longitude),
		input.Address,
		input.City,
		input.PostalCode,
		nullString(input.Logo),
		nullString(input.ContactPhoneNumber),
		nullString(input.SIRET),
		isVerified,
		isActive,
		organizationID,
	)
	if err != nil {
		return nil, mapConstraintError("update organization", err)
	}
	if err := requireRows(res, ErrOrganizationNotFound); err != nil {
		return nil, err
	}

	if err := r.replaceCategoriesInTx(ctx, tx, organizationID, input.CategoryIDs, input.CategorySlugs); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit update organization tx: %w", err)
	}

	return r.GetByID(ctx, organizationID, true, false)
}

func (r *Repository) SetActive(ctx context.Context, organizationID int64, active bool, actorRole string) (*Organization, error) {
	if !isAdmin(actorRole) {
		return nil, ErrForbidden
	}

	res, err := r.db.ExecContext(ctx, `
		UPDATE organizations
		SET is_active = $1,
		    updated_at = NOW()
		WHERE id = $2
		  AND deleted_at IS NULL
	`, active, organizationID)
	if err != nil {
		return nil, fmt.Errorf("set organization active: %w", err)
	}
	if err := requireRows(res, ErrOrganizationNotFound); err != nil {
		return nil, err
	}

	return r.GetByID(ctx, organizationID, true, false)
}

func (r *Repository) SetVerified(ctx context.Context, organizationID int64, verified bool, actorRole string) (*Organization, error) {
	if !isAdmin(actorRole) {
		return nil, ErrForbidden
	}

	res, err := r.db.ExecContext(ctx, `
		UPDATE organizations
		SET is_verified = $1,
		    updated_at = NOW()
		WHERE id = $2
		  AND deleted_at IS NULL
	`, verified, organizationID)
	if err != nil {
		return nil, fmt.Errorf("set organization verification: %w", err)
	}
	if err := requireRows(res, ErrOrganizationNotFound); err != nil {
		return nil, err
	}

	return r.GetByID(ctx, organizationID, true, false)
}

func (r *Repository) Delete(ctx context.Context, organizationID int64, actorAccountID int64, actorRole string) error {
	if !isAdmin(actorRole) {
		return ErrForbidden
	}

	res, err := r.db.ExecContext(ctx, `
		UPDATE organizations
		SET deleted_at = COALESCE(deleted_at, NOW()),
		    is_active = FALSE,
		    updated_at = NOW()
		WHERE id = $1
		  AND deleted_at IS NULL
	`, organizationID)
	if err != nil {
		return fmt.Errorf("delete organization: %w", err)
	}

	return requireRows(res, ErrOrganizationNotFound)
}

func (r *Repository) Restore(ctx context.Context, organizationID int64, actorRole string) (*Organization, error) {
	if !isAdmin(actorRole) {
		return nil, ErrForbidden
	}

	res, err := r.db.ExecContext(ctx, `
		UPDATE organizations
		SET deleted_at = NULL,
		    is_active = TRUE,
		    updated_at = NOW()
		WHERE id = $1
		  AND deleted_at IS NOT NULL
	`, organizationID)
	if err != nil {
		return nil, mapConstraintError("restore organization", err)
	}
	if err := requireRows(res, ErrOrganizationNotFound); err != nil {
		return nil, err
	}

	return r.GetByID(ctx, organizationID, true, false)
}

func (r *Repository) ListCategories(ctx context.Context) ([]Category, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, slug
		FROM organization_categories
		ORDER BY name ASC, id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list organization categories: %w", err)
	}
	defer rows.Close()

	var categories []Category
	for rows.Next() {
		var category Category
		if err := rows.Scan(&category.ID, &category.Name, &category.Slug); err != nil {
			return nil, fmt.Errorf("scan organization category: %w", err)
		}
		categories = append(categories, category)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate organization categories: %w", err)
	}

	return categories, nil
}

func (r *Repository) ReplaceCategories(ctx context.Context, organizationID int64, categoryIDs []int64, categorySlugs []string, actorAccountID int64, actorRole string) (*Organization, error) {
	current, err := r.GetByID(ctx, organizationID, true, false)
	if err != nil {
		return nil, err
	}
	if !canManageOrganizationProfile(current, actorAccountID, actorRole) {
		return nil, ErrForbidden
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin replace organization categories tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if err := r.replaceCategoriesInTx(ctx, tx, organizationID, categoryIDs, categorySlugs); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit replace organization categories tx: %w", err)
	}

	return r.GetByID(ctx, organizationID, true, false)
}

func (r *Repository) ClearCategories(ctx context.Context, organizationID int64, actorAccountID int64, actorRole string) (*Organization, error) {
	return r.ReplaceCategories(ctx, organizationID, nil, nil, actorAccountID, actorRole)
}

func (r *Repository) ListMembers(ctx context.Context, organizationID int64, actorAccountID int64, actorRole string) ([]Organizer, error) {
	organization, err := r.GetByID(ctx, organizationID, true, false)
	if err != nil {
		return nil, err
	}
	if !isAdmin(actorRole) && !strings.EqualFold(actorRole, "moderator") && organization.AccountID != actorAccountID {
		userID, err := r.userProfileID(ctx, actorAccountID)
		if err != nil {
			return nil, ErrForbidden
		}
		member, err := r.isMember(ctx, userID, organizationID)
		if err != nil {
			return nil, err
		}
		if !member {
			return nil, ErrForbidden
		}
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, organization_id, job_role, created_at, updated_at, deleted_at
		FROM organizers
		WHERE organization_id = $1
		  AND deleted_at IS NULL
		ORDER BY id ASC
	`, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list organization members: %w", err)
	}
	defer rows.Close()

	var members []Organizer
	for rows.Next() {
		member, err := scanOrganizer(rows)
		if err != nil {
			return nil, fmt.Errorf("scan organization member: %w", err)
		}
		members = append(members, *member)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate organization members: %w", err)
	}

	return members, nil
}

func (r *Repository) AddMember(ctx context.Context, organizationID int64, input MemberInput, actorAccountID int64, actorRole string) (*Organizer, error) {
	current, err := r.GetByID(ctx, organizationID, true, false)
	if err != nil {
		return nil, err
	}
	if !canManageOrganizationProfile(current, actorAccountID, actorRole) {
		return nil, ErrForbidden
	}
	if err := r.ensureUserExists(ctx, input.UserID); err != nil {
		return nil, err
	}

	var member Organizer
	var jobRole sql.NullString
	var deletedAt sql.NullTime
	err = r.db.QueryRowContext(ctx, `
		INSERT INTO organizers (user_id, organization_id, job_role, deleted_at, updated_at)
		VALUES ($1, $2, $3, NULL, NOW())
		ON CONFLICT (user_id, organization_id)
		DO UPDATE SET job_role = EXCLUDED.job_role, deleted_at = NULL, updated_at = NOW()
		RETURNING id, user_id, organization_id, job_role, created_at, updated_at, deleted_at
	`, input.UserID, organizationID, nullString(input.JobRole)).Scan(
		&member.ID,
		&member.UserID,
		&member.OrganizationID,
		&jobRole,
		&member.CreatedAt,
		&member.UpdatedAt,
		&deletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("add organization member: %w", err)
	}
	member.JobRole = nullableStringPtr(jobRole)
	if deletedAt.Valid {
		member.DeletedAt = &deletedAt.Time
	}

	return &member, nil
}

func (r *Repository) RemoveMember(ctx context.Context, organizationID int64, userID int64, actorAccountID int64, actorRole string) error {
	current, err := r.GetByID(ctx, organizationID, true, false)
	if err != nil {
		return err
	}
	if !canManageOrganizationProfile(current, actorAccountID, actorRole) {
		return ErrForbidden
	}

	res, err := r.db.ExecContext(ctx, `
		UPDATE organizers
		SET deleted_at = COALESCE(deleted_at, NOW()),
		    updated_at = NOW()
		WHERE organization_id = $1
		  AND user_id = $2
		  AND deleted_at IS NULL
	`, organizationID, userID)
	if err != nil {
		return fmt.Errorf("remove organization member: %w", err)
	}

	return requireRows(res, ErrOrganizerNotFound)
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
			return 0, ErrUserNotFound
		}
		return 0, fmt.Errorf("get user profile id: %w", err)
	}

	return userID, nil
}

func (r *Repository) ensureAccountExists(ctx context.Context, accountID int64) error {
	if accountID <= 0 {
		return ErrAccountRequired
	}
	var exists bool
	err := r.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM accounts
			WHERE id = $1
			  AND deleted_at IS NULL
		)
	`, accountID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check account exists: %w", err)
	}
	if !exists {
		return ErrAccountNotFound
	}
	return nil
}

func (r *Repository) ensureUserExists(ctx context.Context, userID int64) error {
	if userID <= 0 {
		return ErrUserNotFound
	}
	var exists bool
	err := r.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM users
			WHERE id = $1
			  AND deleted_at IS NULL
		)
	`, userID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check user exists: %w", err)
	}
	if !exists {
		return ErrUserNotFound
	}
	return nil
}

func (r *Repository) isMember(ctx context.Context, userID int64, organizationID int64) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM organizers
			WHERE user_id = $1
			  AND organization_id = $2
			  AND deleted_at IS NULL
		)
	`, userID, organizationID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check organization member: %w", err)
	}
	return exists, nil
}

func (r *Repository) replaceCategoriesInTx(ctx context.Context, tx *sql.Tx, organizationID int64, categoryIDs []int64, categorySlugs []string) error {
	ids, err := r.resolveCategoryIDs(ctx, tx, categoryIDs, categorySlugs)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM organization_categories_links WHERE organization_id = $1`, organizationID); err != nil {
		return fmt.Errorf("clear organization categories: %w", err)
	}

	for _, categoryID := range ids {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO organization_categories_links (organization_id, organization_category_id)
			VALUES ($1, $2)
			ON CONFLICT (organization_id, organization_category_id) DO NOTHING
		`, organizationID, categoryID); err != nil {
			return fmt.Errorf("add organization category: %w", err)
		}
	}

	return nil
}

func (r *Repository) resolveCategoryIDs(ctx context.Context, tx *sql.Tx, categoryIDs []int64, categorySlugs []string) ([]int64, error) {
	seen := make(map[int64]struct{})
	resolved := make([]int64, 0, len(categoryIDs)+len(categorySlugs))

	for _, id := range categoryIDs {
		if id <= 0 {
			return nil, ErrCategoryNotFound
		}
		var exists bool
		err := tx.QueryRowContext(ctx, `
			SELECT EXISTS (SELECT 1 FROM organization_categories WHERE id = $1)
		`, id).Scan(&exists)
		if err != nil {
			return nil, fmt.Errorf("check organization category: %w", err)
		}
		if !exists {
			return nil, ErrCategoryNotFound
		}
		if _, ok := seen[id]; !ok {
			seen[id] = struct{}{}
			resolved = append(resolved, id)
		}
	}

	for _, slug := range categorySlugs {
		slug = strings.TrimSpace(strings.ToLower(slug))
		if slug == "" {
			continue
		}
		var id int64
		err := tx.QueryRowContext(ctx, `
			SELECT id
			FROM organization_categories
			WHERE slug = $1
		`, slug).Scan(&id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, ErrCategoryNotFound
			}
			return nil, fmt.Errorf("resolve organization category: %w", err)
		}
		if _, ok := seen[id]; !ok {
			seen[id] = struct{}{}
			resolved = append(resolved, id)
		}
	}

	return resolved, nil
}

func buildOrganizationWhere(filters ListFilters) (string, []any) {
	clauses := []string{"1 = 1"}
	args := make([]any, 0, 4)

	if !filters.IncludeDeleted {
		clauses = append(clauses, "o.deleted_at IS NULL")
	}
	if !filters.IncludeInactive {
		clauses = append(clauses, "o.is_active = TRUE")
	}
	if filters.AccountID != nil {
		args = append(args, *filters.AccountID)
		clauses = append(clauses, "o.account_id = $"+strconv.Itoa(len(args)))
	}
	if filters.Query != "" {
		args = append(args, "%"+strings.ToLower(filters.Query)+"%")
		clauses = append(clauses, "(LOWER(o.name) LIKE $"+strconv.Itoa(len(args))+" OR LOWER(o.city) LIKE $"+strconv.Itoa(len(args))+" OR LOWER(o.contact_email) LIKE $"+strconv.Itoa(len(args))+")")
	}

	return " WHERE " + strings.Join(clauses, " AND ") + "\n", args
}

func effectiveAccountID(inputAccountID *int64, actorAccountID int64, actorRole string) (int64, error) {
	if isAdmin(actorRole) && inputAccountID != nil {
		if *inputAccountID <= 0 {
			return 0, ErrAccountRequired
		}
		return *inputAccountID, nil
	}
	if actorAccountID <= 0 {
		return 0, ErrAccountRequired
	}
	return actorAccountID, nil
}

func canManageOrganizationProfile(organization *Organization, actorAccountID int64, actorRole string) bool {
	if organization == nil {
		return false
	}
	return isAdmin(actorRole) || organization.AccountID == actorAccountID
}

func isAdmin(role string) bool {
	return strings.EqualFold(strings.TrimSpace(role), "admin")
}

func boolDefault(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func nullString(value *string) sql.NullString {
	if value == nil {
		return sql.NullString{}
	}
	trimmed := strings.TrimSpace(*value)
	return sql.NullString{String: trimmed, Valid: trimmed != ""}
}

func nullFloat(value *float64) sql.NullFloat64 {
	if value == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *value, Valid: true}
}

func nullableStringPtr(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func nullableFloatPtr(value sql.NullFloat64) *float64 {
	if !value.Valid {
		return nil
	}
	return &value.Float64
}

func splitCSV(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
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

func scanOrganizer(scanner interface {
	Scan(dest ...any) error
}) (*Organizer, error) {
	var organizer Organizer
	var jobRole sql.NullString
	var deletedAt sql.NullTime
	err := scanner.Scan(
		&organizer.ID,
		&organizer.UserID,
		&organizer.OrganizationID,
		&jobRole,
		&organizer.CreatedAt,
		&organizer.UpdatedAt,
		&deletedAt,
	)
	if err != nil {
		return nil, err
	}
	organizer.JobRole = nullableStringPtr(jobRole)
	if deletedAt.Valid {
		organizer.DeletedAt = &deletedAt.Time
	}
	return &organizer, nil
}

func requireRows(result sql.Result, notFound error) error {
	n, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if n == 0 {
		return notFound
	}
	return nil
}

func mapConstraintError(action string, err error) error {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "organizations_account_id_key"):
		return ErrAccountAlreadyUsed
	case strings.Contains(msg, "idx_organizations_contact_email_active") ||
		strings.Contains(msg, "organizations_contact_email"):
		return ErrContactEmailUsed
	case strings.Contains(msg, "idx_organizations_siret_active") ||
		strings.Contains(msg, "organizations_siret"):
		return ErrSIRETAlreadyUsed
	default:
		return fmt.Errorf("%s: %w", action, err)
	}
}
