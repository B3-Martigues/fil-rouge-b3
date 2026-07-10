package events

import "context"

type Service struct {
	Repo *Repository
}

func (s Service) List(ctx context.Context, filters ListFilters) ([]Event, error) {
	return s.repo().List(ctx, filters)
}

func (s Service) ListManagedByOrganization(ctx context.Context, organizationID int64, accountID int64, role string, filters ListFilters) ([]Event, error) {
	return s.repo().ListManagedByOrganization(ctx, organizationID, accountID, role, filters)
}

func (s Service) GetByID(ctx context.Context, id int64, includeInactive bool) (*Event, error) {
	return s.repo().GetByID(ctx, id, includeInactive)
}

func (s Service) Create(ctx context.Context, input EventInput, accountID int64, role string) (*Event, error) {
	return s.repo().Create(ctx, input, accountID, role)
}

func (s Service) Update(ctx context.Context, eventID int64, input EventInput, accountID int64, role string) (*Event, error) {
	return s.repo().Update(ctx, eventID, input, accountID, role)
}

func (s Service) Delete(ctx context.Context, eventID int64, accountID int64, role string) error {
	return s.repo().Delete(ctx, eventID, accountID, role)
}

func (s Service) SetActive(ctx context.Context, eventID int64, active bool, accountID int64, role string) (*Event, error) {
	return s.repo().SetActive(ctx, eventID, active, accountID, role)
}

func (s Service) ListCategories(ctx context.Context) ([]Category, error) {
	return s.repo().ListCategories(ctx)
}

func (s Service) GetCategory(ctx context.Context, id int64) (*Category, error) {
	return s.repo().GetCategory(ctx, id)
}

func (s Service) ReplaceCategories(ctx context.Context, eventID int64, categoryIDs []int64, categorySlugs []string, accountID int64, role string) (*Event, error) {
	return s.repo().ReplaceCategories(ctx, eventID, categoryIDs, categorySlugs, accountID, role)
}

func (s Service) AddCategory(ctx context.Context, eventID int64, categoryID int64, accountID int64, role string) (*Event, error) {
	return s.repo().AddCategory(ctx, eventID, categoryID, accountID, role)
}

func (s Service) RemoveCategory(ctx context.Context, eventID int64, categoryID int64, accountID int64, role string) (*Event, error) {
	return s.repo().RemoveCategory(ctx, eventID, categoryID, accountID, role)
}

func (s Service) AddFavorite(ctx context.Context, accountID int64, eventID int64) (*Favorite, error) {
	return s.repo().AddFavorite(ctx, accountID, eventID)
}

func (s Service) RemoveFavorite(ctx context.Context, accountID int64, eventID int64) error {
	return s.repo().RemoveFavorite(ctx, accountID, eventID)
}

func (s Service) IsFavorite(ctx context.Context, accountID int64, eventID int64) (bool, error) {
	return s.repo().IsFavorite(ctx, accountID, eventID)
}

func (s Service) ListFavorites(ctx context.Context, accountID int64) ([]Favorite, error) {
	return s.repo().ListFavorites(ctx, accountID)
}

func (s Service) RecordHistory(ctx context.Context, accountID int64, eventID int64) (*History, error) {
	return s.repo().RecordHistory(ctx, accountID, eventID)
}

func (s Service) ListHistory(ctx context.Context, accountID int64) ([]History, error) {
	return s.repo().ListHistory(ctx, accountID)
}

func (s Service) RemoveHistory(ctx context.Context, accountID int64, historyID int64) error {
	return s.repo().RemoveHistory(ctx, accountID, historyID)
}

func (s Service) repo() *Repository {
	return s.Repo
}
