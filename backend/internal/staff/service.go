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

func (s Service) Accounts(ctx context.Context) ([]Account, error) {
	return s.repo().listAccounts(ctx)
}

func (s Service) Users(ctx context.Context) ([]User, error) {
	return s.repo().listUsers(ctx)
}

func (s Service) Organizations(ctx context.Context) ([]Organization, error) {
	return s.repo().listOrganizations(ctx)
}

func (s Service) Organizers(ctx context.Context) ([]Organizer, error) {
	return s.repo().listOrganizers(ctx)
}

func (s Service) Events(ctx context.Context) ([]events.Event, error) {
	return s.repo().listEvents(ctx)
}

func (s Service) NotificationTypes(ctx context.Context) ([]NotificationType, error) {
	return s.repo().listNotificationTypes(ctx)
}

func (s Service) Notifications(ctx context.Context) ([]Notification, error) {
	return s.repo().listNotifications(ctx)
}

func (s Service) ModerationReports(ctx context.Context) ([]ModerationReport, error) {
	return s.repo().listReports(ctx)
}

func (s Service) ModerationDecisions(ctx context.Context) ([]ModerationDecision, error) {
	return s.repo().listDecisions(ctx)
}

func (s Service) repo() *Repository {
	return s.Repo
}
