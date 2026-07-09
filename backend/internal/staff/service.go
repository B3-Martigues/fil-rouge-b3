package staff

import (
	"context"

	"mappening/internal/events"
)

type Service struct {
	Repo *Repository
}

func (s Service) ApplyAction(ctx context.Context, req ActionRequest, moderatorUserID int64, role string) error {
	return s.repo().ApplyAction(ctx, req, moderatorUserID, role)
}

func (s Service) CreateReport(ctx context.Context, req CreateReportRequest, authenticatedUserID int64) (*ModerationReport, error) {
	return s.repo().CreateReport(ctx, req, authenticatedUserID)
}

func (s Service) UserProfileIDByAccountID(ctx context.Context, accountID int64) (int64, error) {
	var userID int64
	err := s.repo().db.QueryRowContext(ctx, `
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

func (s Service) Summary(ctx context.Context, options ListOptions) (*Summary, error) {
	return s.repo().summary(ctx, options)
}

func (s Service) Accounts(ctx context.Context, options ListOptions) ([]Account, error) {
	return s.repo().listAccounts(ctx, options)
}

func (s Service) Users(ctx context.Context, options ListOptions) ([]User, error) {
	return s.repo().listUsers(ctx, options)
}

func (s Service) Organizations(ctx context.Context, options ListOptions) ([]Organization, error) {
	return s.repo().listOrganizations(ctx, options)
}

func (s Service) Organizers(ctx context.Context, options ListOptions) ([]Organizer, error) {
	return s.repo().listOrganizers(ctx, options)
}

func (s Service) Events(ctx context.Context, options ListOptions) ([]events.Event, error) {
	return s.repo().listEvents(ctx, options)
}

func (s Service) NotificationTypes(ctx context.Context) ([]NotificationType, error) {
	return s.repo().listNotificationTypes(ctx)
}

func (s Service) Notifications(ctx context.Context, options ListOptions) ([]Notification, error) {
	return s.repo().listNotifications(ctx, options)
}

func (s Service) ModerationReports(ctx context.Context, options ListOptions) ([]ModerationReport, error) {
	return s.repo().listReports(ctx, options)
}

func (s Service) ModerationDecisions(ctx context.Context, options ListOptions) ([]ModerationDecision, error) {
	return s.repo().listDecisions(ctx, options)
}

func (s Service) repo() *Repository {
	return s.Repo
}
