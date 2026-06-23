package organizations

import (
	"context"
	"strings"
)

type Service struct {
	Repo *Repository
}

func (s Service) ListPublic(ctx context.Context, filters ListFilters) ([]Organization, error) {
	filters.IncludeDeleted = false
	filters.IncludeInactive = false
	return s.repo().List(ctx, filters)
}

func (s Service) GetPublic(ctx context.Context, id int64) (*Organization, error) {
	return s.repo().GetByID(ctx, id, false, false)
}

func (s Service) GetMine(ctx context.Context, actorAccountID int64) (*Organization, error) {
	return s.repo().GetByAccountID(ctx, actorAccountID, true, false)
}

func (s Service) ListMine(ctx context.Context, actorAccountID int64) ([]Organization, error) {
	userID, err := s.repo().userProfileID(ctx, actorAccountID)
	if err != nil {
		return nil, err
	}
	return s.repo().ListByUser(ctx, userID, true, false)
}

func (s Service) ListByUser(ctx context.Context, userID int64, actorAccountID int64, actorRole string) ([]Organization, error) {
	if userID <= 0 {
		return nil, ErrUserNotFound
	}
	if !isStaff(actorRole) {
		currentUserID, err := s.repo().userProfileID(ctx, actorAccountID)
		if err != nil {
			return nil, ErrForbidden
		}
		if currentUserID != userID {
			return nil, ErrForbidden
		}
	}
	return s.repo().ListByUser(ctx, userID, true, false)
}

func (s Service) Create(ctx context.Context, input OrganizationInput, actorAccountID int64, actorRole string) (*Organization, error) {
	return s.repo().Create(ctx, input, actorAccountID, actorRole)
}

func (s Service) Update(ctx context.Context, id int64, input OrganizationInput, actorAccountID int64, actorRole string) (*Organization, error) {
	return s.repo().Update(ctx, id, input, actorAccountID, actorRole)
}

func (s Service) SetActive(ctx context.Context, id int64, active bool, actorRole string) (*Organization, error) {
	return s.repo().SetActive(ctx, id, active, actorRole)
}

func (s Service) SetVerified(ctx context.Context, id int64, verified bool, actorRole string) (*Organization, error) {
	return s.repo().SetVerified(ctx, id, verified, actorRole)
}

func (s Service) Delete(ctx context.Context, id int64, actorAccountID int64, actorRole string) error {
	return s.repo().Delete(ctx, id, actorAccountID, actorRole)
}

func (s Service) Restore(ctx context.Context, id int64, actorRole string) (*Organization, error) {
	return s.repo().Restore(ctx, id, actorRole)
}

func (s Service) ListCategories(ctx context.Context) ([]Category, error) {
	return s.repo().ListCategories(ctx)
}

func (s Service) ReplaceCategories(ctx context.Context, id int64, categoryIDs []int64, categorySlugs []string, actorAccountID int64, actorRole string) (*Organization, error) {
	return s.repo().ReplaceCategories(ctx, id, categoryIDs, categorySlugs, actorAccountID, actorRole)
}

func (s Service) ClearCategories(ctx context.Context, id int64, actorAccountID int64, actorRole string) (*Organization, error) {
	return s.repo().ClearCategories(ctx, id, actorAccountID, actorRole)
}

func (s Service) ListMembers(ctx context.Context, id int64, actorAccountID int64, actorRole string) ([]Organizer, error) {
	return s.repo().ListMembers(ctx, id, actorAccountID, actorRole)
}

func (s Service) AddMember(ctx context.Context, id int64, input MemberInput, actorAccountID int64, actorRole string) (*Organizer, error) {
	return s.repo().AddMember(ctx, id, input, actorAccountID, actorRole)
}

func (s Service) RemoveMember(ctx context.Context, id int64, userID int64, actorAccountID int64, actorRole string) error {
	return s.repo().RemoveMember(ctx, id, userID, actorAccountID, actorRole)
}

func (s Service) repo() *Repository {
	return s.Repo
}

func isStaff(role string) bool {
	role = strings.TrimSpace(strings.ToLower(role))
	return role == "admin" || role == "moderator"
}
