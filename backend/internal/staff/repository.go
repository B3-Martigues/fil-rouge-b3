package staff

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	"mappening/internal/events"
	"mappening/internal/mailer"
)

var (
	ErrNotFound   = errors.New("staff resource not found")
	ErrForbidden  = errors.New("staff action forbidden")
	ErrValidation = errors.New("invalid staff request")
)

type Repository struct {
	db          *sql.DB
	eventRepo   *events.Repository
	mailSender  mailer.Sender
	frontendURL string
}

func NewRepository(db *sql.DB) *Repository {
	return NewRepositoryWithMailer(db, nil, "")
}

func NewRepositoryWithMailer(db *sql.DB, sender mailer.Sender, frontendURL string) *Repository {
	return &Repository{db: db, eventRepo: events.NewRepository(db), mailSender: sender, frontendURL: strings.TrimRight(frontendURL, "/")}
}

func (r *Repository) ApplyAction(ctx context.Context, req ActionRequest, moderatorUserID int64, role string) error {
	req.Action = strings.TrimSpace(strings.ToLower(req.Action))
	req.TargetType = strings.TrimSpace(strings.ToLower(req.TargetType))
	req.Reason = strings.TrimSpace(req.Reason)
	if req.Action == "" || req.TargetType == "" || req.TargetID <= 0 || len(req.Reason) < 5 {
		return ErrValidation
	}
	if !canApplyAction(role, req.Action) {
		return ErrForbidden
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin staff action tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if err := r.applyTargetMutation(ctx, tx, req); err != nil {
		return err
	}
	if req.ReportID != nil {
		status := "reviewing"
		if req.ReportStatus != nil && strings.TrimSpace(*req.ReportStatus) != "" {
			status = strings.TrimSpace(strings.ToLower(*req.ReportStatus))
		}
		if err := updateReportInTx(ctx, tx, *req.ReportID, status, moderatorUserID, req.Reason); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO moderation_decisions (action, target_type, target_id, moderator_user_id, reason)
		VALUES ($1, $2, $3, $4, $5)
	`, req.Action, req.TargetType, req.TargetID, moderatorUserID, req.Reason); err != nil {
		return fmt.Errorf("record moderation decision: %w", err)
	}
	emailMessages, err := r.createActionNotification(ctx, tx, req)
	if err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit staff action tx: %w", err)
	}
	r.sendActionEmails(emailMessages)

	return nil
}

func (r *Repository) CreateReport(ctx context.Context, req CreateReportRequest, authenticatedUserID int64) (*ModerationReport, error) {
	req.TargetType = strings.TrimSpace(strings.ToLower(req.TargetType))
	req.Reason = strings.TrimSpace(req.Reason)
	req.Details = strings.TrimSpace(req.Details)
	req.Priority = strings.TrimSpace(strings.ToLower(req.Priority))
	if req.Priority == "" {
		req.Priority = "medium"
	}
	if req.Priority != "low" && req.Priority != "medium" && req.Priority != "high" {
		return nil, ErrValidation
	}
	if req.ReporterUserID <= 0 {
		req.ReporterUserID = authenticatedUserID
	}
	if req.TargetID <= 0 || req.TargetType == "" || req.Reason == "" || len(req.Details) < 10 {
		return nil, ErrValidation
	}
	if req.ReporterUserID != authenticatedUserID {
		return nil, ErrForbidden
	}
	if err := r.ensureReportTargetExists(ctx, req.TargetType, req.TargetID); err != nil {
		return nil, err
	}

	var report ModerationReport
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO moderation_reports (
			target_type, target_id, reporter_user_id, reason, details, priority
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, target_type, target_id, reporter_user_id, reason, details,
			status, priority, created_at, updated_at, resolved_at,
			handled_by_user_id, resolution_note
	`, req.TargetType, req.TargetID, req.ReporterUserID, req.Reason, req.Details, req.Priority).Scan(
		&report.ID,
		&report.TargetType,
		&report.TargetID,
		&report.ReporterUserID,
		&report.Reason,
		&report.Details,
		&report.Status,
		&report.Priority,
		&report.CreatedAt,
		&report.UpdatedAt,
		&report.ResolvedAt,
		&report.HandledByUserID,
		&report.ResolutionNote,
	)
	if err != nil {
		if strings.Contains(err.Error(), "idx_moderation_reports_open_unique") {
			return nil, ErrValidation
		}
		return nil, fmt.Errorf("create moderation report: %w", err)
	}
	return &report, nil
}

func (r *Repository) ensureReportTargetExists(ctx context.Context, targetType string, targetID int64) error {
	var table string
	switch targetType {
	case "event":
		table = "events"
	case "organization":
		table = "organizations"
	case "account":
		table = "accounts"
	default:
		return ErrValidation
	}

	query := fmt.Sprintf("SELECT EXISTS (SELECT 1 FROM %s WHERE id = $1 AND deleted_at IS NULL)", table)
	var exists bool
	if err := r.db.QueryRowContext(ctx, query, targetID).Scan(&exists); err != nil {
		return fmt.Errorf("check moderation target: %w", err)
	}
	if !exists {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) applyTargetMutation(ctx context.Context, tx *sql.Tx, req ActionRequest) error {
	var res sql.Result
	var err error
	switch req.Action {
	case "account_suspended":
		res, err = tx.ExecContext(ctx, `
			UPDATE accounts
			SET suspended_until = $1, suspension_reason = $2, updated_at = NOW()
			WHERE id = $3 AND deleted_at IS NULL
		`, parseOptionalActionTime(req.SuspendedUntil), req.Reason, req.TargetID)
	case "account_restored":
		res, err = tx.ExecContext(ctx, `
			UPDATE accounts
			SET suspended_until = NULL, suspension_reason = NULL, is_active = TRUE, updated_at = NOW()
			WHERE id = $1 AND deleted_at IS NULL
		`, req.TargetID)
	case "account_deleted":
		res, err = tx.ExecContext(ctx, `
			UPDATE accounts
			SET deleted_at = COALESCE(deleted_at, NOW()), is_active = FALSE, updated_at = NOW()
			WHERE id = $1
		`, req.TargetID)
	case "event_approved", "event_restored":
		res, err = tx.ExecContext(ctx, `
			UPDATE events
			SET is_active = TRUE, deleted_at = NULL, suspended_until = NULL,
			    suspension_reason = NULL, updated_at = NOW()
			WHERE id = $1
		`, req.TargetID)
	case "event_hidden":
		res, err = tx.ExecContext(ctx, `
			UPDATE events
			SET suspended_until = $1, suspension_reason = $2, updated_at = NOW()
			WHERE id = $3 AND deleted_at IS NULL
		`, parseOptionalActionTime(req.SuspendedUntil), req.Reason, req.TargetID)
	case "event_rejected", "event_deleted":
		res, err = tx.ExecContext(ctx, `
			UPDATE events
			SET is_active = FALSE, deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW()
			WHERE id = $1
		`, req.TargetID)
	case "organization_approved":
		res, err = tx.ExecContext(ctx, `
			UPDATE organizations
			SET is_active = TRUE, is_verified = TRUE, deleted_at = NULL, updated_at = NOW()
			WHERE id = $1
		`, req.TargetID)
	case "organization_rejected", "organization_deleted":
		res, err = tx.ExecContext(ctx, `
			UPDATE organizations
			SET is_active = FALSE, is_verified = FALSE,
			    deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW()
			WHERE id = $1
		`, req.TargetID)
	case "organization_admin_updated", "event_admin_updated", "account_admin_updated", "report_reviewing", "report_resolved", "report_dismissed":
		return nil
	default:
		return ErrValidation
	}
	if err != nil {
		return fmt.Errorf("apply staff action %s: %w", req.Action, err)
	}
	if res == nil {
		return nil
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("staff action rows affected: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	if req.Action == "account_suspended" || req.Action == "account_deleted" {
		if err := deleteRefreshTokensForAccount(ctx, tx, req.TargetID); err != nil {
			return err
		}
	}
	switch req.Action {
	case "organization_approved":
		if err := syncOrganizationAccountActive(ctx, tx, req.TargetID, true); err != nil {
			return err
		}
	case "organization_rejected", "organization_deleted":
		if err := syncOrganizationAccountActive(ctx, tx, req.TargetID, false); err != nil {
			return err
		}
	}
	return nil
}

func deleteRefreshTokensForAccount(ctx context.Context, tx *sql.Tx, accountID int64) error {
	_, err := tx.ExecContext(ctx, `
		DELETE FROM auth_refresh_tokens
		WHERE subject IN (
			SELECT login_email
			FROM accounts
			WHERE id = $1
		)
	`, accountID)
	if err != nil {
		return fmt.Errorf("delete account refresh tokens: %w", err)
	}
	return nil
}

func syncOrganizationAccountActive(ctx context.Context, tx *sql.Tx, organizationID int64, active bool) error {
	var accountID int64
	if err := tx.QueryRowContext(ctx, `
		SELECT account_id
		FROM organizations
		WHERE id = $1
	`, organizationID).Scan(&accountID); err != nil {
		return fmt.Errorf("find organization account: %w", err)
	}

	res, err := tx.ExecContext(ctx, `
		UPDATE accounts
		SET is_active = $1,
		    updated_at = NOW()
		WHERE id = $2
		  AND deleted_at IS NULL
	`, active, accountID)
	if err != nil {
		return fmt.Errorf("sync organization account active: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("sync organization account rows affected: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	if active {
		return nil
	}
	return deleteRefreshTokensForAccount(ctx, tx, accountID)
}

func (r *Repository) createActionNotification(ctx context.Context, tx *sql.Tx, req ActionRequest) ([]mailer.Message, error) {
	recipientUserIDs, organizationID, eventID, err := recipientUsersForAction(ctx, tx, req.TargetType, req.TargetID)
	if err != nil {
		return nil, err
	}
	if len(recipientUserIDs) == 0 {
		return nil, nil
	}

	typeID, err := notificationTypeForAction(ctx, tx, req.Action)
	if err != nil {
		return nil, err
	}
	title := notificationTitle(req.Action)
	actionPath := actionURL(req.TargetType, req.TargetID)
	messages := make([]mailer.Message, 0, len(recipientUserIDs))
	for _, recipient := range recipientUserIDs {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO notifications (
				user_id, event_id, organization_id, notification_type_id, title, message, action_url
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, recipient.UserID, eventID, organizationID, typeID, title, req.Reason, actionPath); err != nil {
			return nil, fmt.Errorf("create action notification: %w", err)
		}
		messages = append(messages, r.notificationEmail(recipient, title, req.Reason, actionPath))
	}
	return messages, nil
}

func (r *Repository) listAccounts(ctx context.Context) ([]Account, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT a.id, a.account_type_id, at.slug, a.login_email, a.password_hash,
			a.password_changed_at, a.is_active, a.suspended_until,
			a.suspension_reason, a.created_at, a.updated_at, a.deleted_at
		FROM accounts a
		JOIN account_types at ON at.id = a.account_type_id
		ORDER BY a.id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list staff accounts: %w", err)
	}
	defer rows.Close()

	var accounts []Account
	for rows.Next() {
		var account Account
		var passwordChangedAt sql.NullTime
		var suspendedUntil sql.NullTime
		var suspensionReason sql.NullString
		var deletedAt sql.NullTime
		if err := rows.Scan(
			&account.ID,
			&account.AccountTypeID,
			&account.AccountType,
			&account.LoginEmail,
			&account.PasswordHash,
			&passwordChangedAt,
			&account.IsActive,
			&suspendedUntil,
			&suspensionReason,
			&account.CreatedAt,
			&account.UpdatedAt,
			&deletedAt,
		); err != nil {
			return nil, fmt.Errorf("scan staff account: %w", err)
		}
		account.PasswordChangedAt = nullableTime(passwordChangedAt)
		account.SuspendedUntil = nullableTime(suspendedUntil)
		account.SuspensionReason = nullableString(suspensionReason)
		account.DeletedAt = nullableTime(deletedAt)
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}

func (r *Repository) listUsers(ctx context.Context) ([]User, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT u.id, u.account_id, u.username, u.role_id, r.slug,
			u.created_at, u.updated_at, u.deleted_at
		FROM users u
		JOIN roles r ON r.id = u.role_id
		ORDER BY u.id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list staff users: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		var deletedAt sql.NullTime
		if err := rows.Scan(&user.ID, &user.AccountID, &user.Username, &user.RoleID, &user.Role, &user.CreatedAt, &user.UpdatedAt, &deletedAt); err != nil {
			return nil, fmt.Errorf("scan staff user: %w", err)
		}
		user.DeletedAt = nullableTime(deletedAt)
		users = append(users, user)
	}
	return users, rows.Err()
}

func (r *Repository) listOrganizations(ctx context.Context) ([]Organization, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT o.id, o.account_id, o.name, o.contact_email, o.role_id,
			o.description, o.website, o.latitude, o.longitude, o.address,
			o.city, o.postal_code, o.logo, o.contact_phone_number, o.siret,
			o.is_verified, o.is_active, o.created_at, o.updated_at, o.deleted_at,
			COALESCE(string_agg(DISTINCT oc.slug, ',' ORDER BY oc.slug), '') AS category_slugs
		FROM organizations o
		LEFT JOIN organization_categories_links ocl ON ocl.organization_id = o.id
		LEFT JOIN organization_categories oc ON oc.id = ocl.organization_category_id
		GROUP BY o.id
		ORDER BY o.name ASC, o.id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list staff organizations: %w", err)
	}
	defer rows.Close()

	var organizations []Organization
	for rows.Next() {
		var organization Organization
		var roleID sql.NullInt64
		var description, website, logo, phone, siret sql.NullString
		var latitude, longitude sql.NullFloat64
		var deletedAt sql.NullTime
		var categorySlugs string
		if err := rows.Scan(
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
		); err != nil {
			return nil, fmt.Errorf("scan staff organization: %w", err)
		}
		organization.RoleID = nullableInt(roleID)
		organization.Description = nullableString(description)
		organization.Website = nullableString(website)
		organization.Latitude = nullableFloat(latitude)
		organization.Longitude = nullableFloat(longitude)
		organization.Logo = nullableString(logo)
		organization.ContactPhoneNumber = nullableString(phone)
		organization.SIRET = nullableString(siret)
		organization.DeletedAt = nullableTime(deletedAt)
		organization.CategorySlugs = splitCSV(categorySlugs)
		organizations = append(organizations, organization)
	}
	return organizations, rows.Err()
}

func (r *Repository) listOrganizers(ctx context.Context) ([]Organizer, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, organization_id, job_role, created_at, updated_at, deleted_at
		FROM organizers
		ORDER BY id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list staff organizers: %w", err)
	}
	defer rows.Close()

	var organizers []Organizer
	for rows.Next() {
		var organizer Organizer
		var jobRole sql.NullString
		var deletedAt sql.NullTime
		if err := rows.Scan(&organizer.ID, &organizer.UserID, &organizer.OrganizationID, &jobRole, &organizer.CreatedAt, &organizer.UpdatedAt, &deletedAt); err != nil {
			return nil, fmt.Errorf("scan staff organizer: %w", err)
		}
		organizer.JobRole = nullableString(jobRole)
		organizer.DeletedAt = nullableTime(deletedAt)
		organizers = append(organizers, organizer)
	}
	return organizers, rows.Err()
}

func (r *Repository) listEvents(ctx context.Context) ([]events.Event, error) {
	eventList, err := r.eventRepo.List(ctx, staffEventListFilters())
	if err != nil {
		return nil, fmt.Errorf("list staff events: %w", err)
	}
	return eventList, nil
}

func staffEventListFilters() events.ListFilters {
	return events.ListFilters{IncludeInactive: true, Sort: "date-asc"}
}

func (r *Repository) listNotificationTypes(ctx context.Context) ([]NotificationType, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, name, slug FROM notification_types ORDER BY id ASC`)
	if err != nil {
		return nil, fmt.Errorf("list notification types: %w", err)
	}
	defer rows.Close()
	var types []NotificationType
	for rows.Next() {
		var item NotificationType
		if err := rows.Scan(&item.ID, &item.Name, &item.Slug); err != nil {
			return nil, fmt.Errorf("scan notification type: %w", err)
		}
		types = append(types, item)
	}
	return types, rows.Err()
}

func (r *Repository) listNotifications(ctx context.Context) ([]Notification, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, event_id, organization_id, notification_type_id,
			title, message, is_read, read_at, action_url, created_at
		FROM notifications
		ORDER BY created_at DESC, id DESC
		LIMIT 500
	`)
	if err != nil {
		return nil, fmt.Errorf("list staff notifications: %w", err)
	}
	defer rows.Close()
	var notifications []Notification
	for rows.Next() {
		var notification Notification
		var eventID, organizationID sql.NullInt64
		var readAt sql.NullTime
		var actionURL sql.NullString
		if err := rows.Scan(
			&notification.ID,
			&notification.UserID,
			&eventID,
			&organizationID,
			&notification.NotificationTypeID,
			&notification.Title,
			&notification.Message,
			&notification.IsRead,
			&readAt,
			&actionURL,
			&notification.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan staff notification: %w", err)
		}
		notification.EventID = nullableInt(eventID)
		notification.OrganizationID = nullableInt(organizationID)
		notification.ReadAt = nullableTime(readAt)
		notification.ActionURL = nullableString(actionURL)
		notifications = append(notifications, notification)
	}
	return notifications, rows.Err()
}

func (r *Repository) listReports(ctx context.Context) ([]ModerationReport, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, target_type, target_id, reporter_user_id, reason, details,
			status, priority, created_at, updated_at, resolved_at,
			handled_by_user_id, resolution_note
		FROM moderation_reports
		ORDER BY created_at DESC, id DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("list moderation reports: %w", err)
	}
	defer rows.Close()
	var reports []ModerationReport
	for rows.Next() {
		var report ModerationReport
		if err := rows.Scan(
			&report.ID,
			&report.TargetType,
			&report.TargetID,
			&report.ReporterUserID,
			&report.Reason,
			&report.Details,
			&report.Status,
			&report.Priority,
			&report.CreatedAt,
			&report.UpdatedAt,
			&report.ResolvedAt,
			&report.HandledByUserID,
			&report.ResolutionNote,
		); err != nil {
			return nil, fmt.Errorf("scan moderation report: %w", err)
		}
		reports = append(reports, report)
	}
	return reports, rows.Err()
}

func (r *Repository) listDecisions(ctx context.Context) ([]ModerationDecision, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, action, target_type, target_id, moderator_user_id, reason, created_at
		FROM moderation_decisions
		ORDER BY created_at DESC, id DESC
		LIMIT 500
	`)
	if err != nil {
		return nil, fmt.Errorf("list moderation decisions: %w", err)
	}
	defer rows.Close()
	var decisions []ModerationDecision
	for rows.Next() {
		var decision ModerationDecision
		if err := rows.Scan(&decision.ID, &decision.Action, &decision.TargetType, &decision.TargetID, &decision.ModeratorUserID, &decision.Reason, &decision.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan moderation decision: %w", err)
		}
		decisions = append(decisions, decision)
	}
	return decisions, rows.Err()
}

func updateReportInTx(ctx context.Context, tx *sql.Tx, reportID int64, status string, moderatorUserID int64, note string) error {
	if status != "open" && status != "reviewing" && status != "resolved" && status != "dismissed" {
		return ErrValidation
	}
	var res sql.Result
	var err error
	if status == "resolved" || status == "dismissed" {
		res, err = tx.ExecContext(ctx, `
			UPDATE moderation_reports
			SET status = $1, handled_by_user_id = $2, resolution_note = $3,
			    resolved_at = NOW(), updated_at = NOW()
			WHERE id = $4
		`, status, moderatorUserID, note, reportID)
	} else {
		res, err = tx.ExecContext(ctx, `
			UPDATE moderation_reports
			SET status = $1, handled_by_user_id = $2, updated_at = NOW()
			WHERE id = $3
		`, status, moderatorUserID, reportID)
	}
	if err != nil {
		return fmt.Errorf("update moderation report: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("update moderation report rows affected: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

type notificationRecipient struct {
	UserID int64
	Email  string
	Name   string
}

func recipientUsersForAction(ctx context.Context, tx *sql.Tx, targetType string, targetID int64) ([]notificationRecipient, *int64, *int64, error) {
	switch targetType {
	case "event":
		var eventID = targetID
		var organizationID sql.NullInt64
		if err := tx.QueryRowContext(ctx, `SELECT organization_id FROM events WHERE id = $1`, targetID).Scan(&organizationID); err != nil {
			return nil, nil, nil, fmt.Errorf("find event organization: %w", err)
		}
		if !organizationID.Valid {
			return nil, nil, &eventID, nil
		}
		users, err := organizationRecipientUsers(ctx, tx, organizationID.Int64)
		return users, &organizationID.Int64, &eventID, err
	case "organization":
		users, err := organizationRecipientUsers(ctx, tx, targetID)
		organizationID := targetID
		return users, &organizationID, nil, err
	case "account":
		var recipient notificationRecipient
		err := tx.QueryRowContext(ctx, `
			SELECT u.id, a.login_email, COALESCE(NULLIF(u.username, ''), SPLIT_PART(a.login_email, '@', 1))
			FROM users u
			JOIN accounts a ON a.id = u.account_id
			WHERE u.account_id = $1
			  AND u.deleted_at IS NULL
			  AND a.deleted_at IS NULL
			LIMIT 1
		`, targetID).Scan(&recipient.UserID, &recipient.Email, &recipient.Name)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, nil, nil
		}
		if err != nil {
			return nil, nil, nil, fmt.Errorf("find account notification user: %w", err)
		}
		return []notificationRecipient{recipient}, nil, nil, nil
	default:
		return nil, nil, nil, ErrValidation
	}
}

func organizationRecipientUsers(ctx context.Context, tx *sql.Tx, organizationID int64) ([]notificationRecipient, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT DISTINCT u.id, a.login_email, COALESCE(NULLIF(u.username, ''), SPLIT_PART(a.login_email, '@', 1))
		FROM users u
		JOIN accounts a ON a.id = u.account_id
		LEFT JOIN organizations o ON o.account_id = u.account_id AND o.id = $1
		LEFT JOIN organizers org ON org.user_id = u.id AND org.organization_id = $1 AND org.deleted_at IS NULL
		WHERE u.deleted_at IS NULL
		  AND a.deleted_at IS NULL
		  AND a.is_active = TRUE
		  AND (o.id IS NOT NULL OR org.id IS NOT NULL)
	`, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list organization notification users: %w", err)
	}
	defer rows.Close()

	var users []notificationRecipient
	for rows.Next() {
		var recipient notificationRecipient
		if err := rows.Scan(&recipient.UserID, &recipient.Email, &recipient.Name); err != nil {
			return nil, fmt.Errorf("scan organization notification user: %w", err)
		}
		users = append(users, recipient)
	}
	return users, rows.Err()
}

func notificationTypeForAction(ctx context.Context, tx *sql.Tx, action string) (int64, error) {
	slug := "moderation_decision"
	switch action {
	case "organization_approved":
		slug = "organization_approved"
	case "organization_rejected", "organization_deleted":
		slug = "organization_rejected"
	case "event_approved":
		slug = "event_approved"
	case "event_rejected":
		slug = "event_rejected"
	case "event_hidden":
		slug = "event_hidden"
	case "event_deleted":
		slug = "event_deleted"
	case "account_suspended":
		slug = "account_suspended"
	}
	var id int64
	if err := tx.QueryRowContext(ctx, `SELECT id FROM notification_types WHERE slug = $1`, slug).Scan(&id); err != nil {
		return 0, fmt.Errorf("resolve notification type: %w", err)
	}
	return id, nil
}

func canApplyAction(role string, action string) bool {
	if strings.EqualFold(role, "admin") {
		return true
	}
	switch action {
	case "event_approved", "event_rejected", "event_hidden", "event_deleted", "event_restored",
		"organization_approved", "organization_rejected",
		"account_suspended", "account_restored",
		"report_reviewing", "report_resolved", "report_dismissed":
		return true
	default:
		return false
	}
}

func parseOptionalActionTime(raw *string) sql.NullTime {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return sql.NullTime{Time: time.Now().UTC().Add(30 * 24 * time.Hour), Valid: true}
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04", "2006-01-02"} {
		if parsed, err := time.Parse(layout, strings.TrimSpace(*raw)); err == nil {
			return sql.NullTime{Time: parsed, Valid: true}
		}
	}
	return sql.NullTime{Time: time.Now().UTC().Add(30 * 24 * time.Hour), Valid: true}
}

func notificationTitle(action string) string {
	switch action {
	case "organization_approved":
		return "Organisation validee"
	case "organization_rejected", "organization_deleted":
		return "Organisation refusee"
	case "event_approved":
		return "Evenement valide"
	case "event_rejected":
		return "Evenement refuse"
	case "event_hidden":
		return "Evenement suspendu"
	case "event_deleted":
		return "Evenement supprime"
	case "account_suspended":
		return "Compte suspendu"
	case "account_restored", "event_restored":
		return "Suspension levee"
	default:
		return "Decision de moderation"
	}
}

func actionURL(targetType string, targetID int64) string {
	switch targetType {
	case "event":
		return "/"
	case "organization":
		return fmt.Sprintf("/organizations/%d", targetID)
	default:
		return "/profile"
	}
}

func (r *Repository) notificationEmail(recipient notificationRecipient, title string, reason string, actionPath string) mailer.Message {
	link := actionPath
	if r.frontendURL != "" && strings.HasPrefix(actionPath, "/") {
		link = r.frontendURL + actionPath
	}

	body := strings.Join([]string{
		"Bonjour " + recipient.Name + ",",
		"",
		title,
		"",
		reason,
		"",
		"Consulter dans Mappening : " + link,
	}, "\n")

	return mailer.Message{
		To:      recipient.Email,
		Subject: title + " - Mappening",
		Text:    body,
	}
}

func (r *Repository) sendActionEmails(messages []mailer.Message) {
	if r.mailSender == nil || len(messages) == 0 {
		return
	}

	for _, message := range messages {
		message := message
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			if err := r.mailSender.Send(ctx, message); err != nil {
				logActionMailError(message.To, err)
			}
		}()
	}
}

func logActionMailError(to string, err error) {
	log.Error().
		Err(err).
		Str("to", to).
		Str("purpose", "moderation notification").
		Msg("mail delivery failed")
}

func nullableString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func nullableTime(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}

func nullableInt(value sql.NullInt64) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

func nullableFloat(value sql.NullFloat64) *float64 {
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
