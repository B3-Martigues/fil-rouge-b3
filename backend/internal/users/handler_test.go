package users

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"mappening/internal/httpx"
)

type fakeAdminUserRepo struct {
	listUsers           []User
	createID            int64
	createdUser         *User
	userByID            *User
	updatedUser         *User
	updatedPasswordID   int64
	updatedPasswordHash string
	deletedUserID       int64
	listErr             error
	createErr           error
	getByIDErr          error
	updateErr           error
	updatePasswordErr   error
	deleteErr           error
}

type fakeSessionStore struct {
	deletedSubjects []string
	deleteErr       error
}

func (f *fakeAdminUserRepo) List(_ context.Context) ([]User, error) {
	return f.listUsers, f.listErr
}

func (f *fakeAdminUserRepo) Create(_ context.Context, user *User) (int64, error) {
	if f.createErr != nil {
		return 0, f.createErr
	}
	cloned := *user
	f.createdUser = &cloned
	if f.createID == 0 {
		f.createID = 1
	}
	return f.createID, nil
}

func (f *fakeAdminUserRepo) GetByID(_ context.Context, _ int64) (*User, error) {
	if f.getByIDErr != nil {
		return nil, f.getByIDErr
	}
	if f.userByID == nil {
		return nil, ErrUserNotFound
	}
	cloned := *f.userByID
	return &cloned, nil
}

func (f *fakeAdminUserRepo) Update(_ context.Context, user *User, passwordHash *string) error {
	if f.updateErr != nil {
		return f.updateErr
	}
	cloned := *user
	f.updatedUser = &cloned
	if passwordHash != nil {
		f.updatedPasswordID = user.ID
		f.updatedPasswordHash = *passwordHash
	}
	return nil
}

func (f *fakeAdminUserRepo) UpdatePreservingAdminAccess(_ context.Context, currentUserID int64, user *User, passwordHash *string) error {
	if f.updateErr != nil {
		return f.updateErr
	}
	if f.userByID == nil {
		return ErrUserNotFound
	}

	if currentUserID == f.userByID.ID && !isActiveAdmin(*user) {
		return ErrSelfAdminAccessRemoval
	}
	if isActiveAdmin(*f.userByID) && !isActiveAdmin(*user) && f.activeAdminCount() <= 1 {
		return ErrLastActiveAdmin
	}

	cloned := *user
	f.updatedUser = &cloned
	if passwordHash != nil {
		f.updatedPasswordID = user.ID
		f.updatedPasswordHash = *passwordHash
	}
	return nil
}

func (f *fakeAdminUserRepo) UpdatePassword(_ context.Context, userID int64, passwordHash string) error {
	if f.updatePasswordErr != nil {
		return f.updatePasswordErr
	}
	f.updatedPasswordID = userID
	f.updatedPasswordHash = passwordHash
	return nil
}

func (f *fakeAdminUserRepo) Delete(_ context.Context, userID int64) error {
	if f.deleteErr != nil {
		return f.deleteErr
	}
	f.deletedUserID = userID
	return nil
}

func (f *fakeAdminUserRepo) DeletePreservingAdminAccess(_ context.Context, currentUserID int64, userID int64) (*User, error) {
	if f.deleteErr != nil {
		return nil, f.deleteErr
	}
	if f.userByID == nil {
		return nil, ErrUserNotFound
	}
	if currentUserID == f.userByID.ID {
		return nil, ErrSelfDeletion
	}
	if isActiveAdmin(*f.userByID) && f.activeAdminCount() <= 1 {
		return nil, ErrLastActiveAdmin
	}

	f.deletedUserID = userID
	cloned := *f.userByID
	return &cloned, nil
}

func (f *fakeAdminUserRepo) activeAdminCount() int {
	count := 0
	for _, user := range f.listUsers {
		if isActiveAdmin(user) {
			count++
		}
	}
	if count == 0 && f.userByID != nil && isActiveAdmin(*f.userByID) {
		return 1
	}
	return count
}

func (f *fakeSessionStore) Delete(subject string) error {
	if f.deleteErr != nil {
		return f.deleteErr
	}
	f.deletedSubjects = append(f.deletedSubjects, subject)
	return nil
}

func adminHandler(repo *fakeAdminUserRepo, sessionStore *fakeSessionStore) AdminHandler {
	return AdminHandler{Service: NewAdminService(repo, sessionStore)}
}

func withURLParam(req *http.Request, key, value string) *http.Request {
	routeCtx := chi.NewRouteContext()
	routeCtx.URLParams.Add(key, value)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, routeCtx))
}

func withCurrentUserID(req *http.Request, userID int64) *http.Request {
	return req.WithContext(httpx.WithCurrentUserID(req.Context(), userID))
}

func TestAdminHandler_List_Returns500WhenRepoMissing(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	rec := httptest.NewRecorder()

	AdminHandler{}.List(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", res.StatusCode)
	}
}

func TestAdminHandler_List_MissingRepoReturnsJSONError(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	rec := httptest.NewRecorder()

	AdminHandler{}.List(rec, req)

	var payload map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode error payload: %v", err)
	}

	if payload["error"] == "" {
		t.Fatalf("expected JSON error payload, got %+v", payload)
	}
}

func TestAdminHandler_Create_NormalizesInput_AndHashesPassword(t *testing.T) {
	repo := &fakeAdminUserRepo{createID: 9}
	handler := adminHandler(repo, nil)

	body := []byte(`{"email":"  ADMIN@Mappening.LOCAL ","password":"secret123456","first_name":"  Jane ","last_name":" Doe ","role":" Admin ","is_active":true}`)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/users", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.Create(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", res.StatusCode)
	}
	if repo.createdUser == nil {
		t.Fatalf("expected repo create to be called")
	}
	if repo.createdUser.Email != "admin@mappening.local" || repo.createdUser.Role != "admin" {
		t.Fatalf("expected normalized email and role, got %+v", repo.createdUser)
	}
	if repo.createdUser.FirstName != "Jane" || repo.createdUser.LastName != "Doe" {
		t.Fatalf("expected trimmed names, got %+v", repo.createdUser)
	}
	if repo.createdUser.PasswordHash == "" || repo.createdUser.PasswordHash == "secret123456" {
		t.Fatalf("expected hashed password, got %+v", repo.createdUser)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(repo.createdUser.PasswordHash), []byte("secret123456")); err != nil {
		t.Fatalf("expected password hash to match original password: %v", err)
	}

	var payload struct {
		ID        int64  `json:"id"`
		Email     string `json:"email"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Role      string `json:"role"`
		IsActive  bool   `json:"is_active"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.ID != 9 || payload.Email != "admin@mappening.local" || payload.Role != "admin" {
		t.Fatalf("unexpected response payload: %+v", payload)
	}
}

func TestAdminHandler_Update_UpdatesUserAndPassword(t *testing.T) {
	sessionStore := &fakeSessionStore{}
	repo := &fakeAdminUserRepo{
		userByID: &User{
			ID:        4,
			Email:     "user@mappening.local",
			FirstName: "Jean",
			LastName:  "Dupont",
			Role:      "user",
			IsActive:  true,
		},
	}
	handler := adminHandler(repo, sessionStore)

	body := []byte(`{"email":"  NEW@Mappening.LOCAL ","first_name":"  Jeanne ","last_name":" Durand ","role":" Admin ","is_active":false,"password":"newsecret123"}`)
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/users/4", bytes.NewReader(body))
	req = withURLParam(req, "userID", "4")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.Update(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.StatusCode)
	}
	if repo.updatedUser == nil {
		t.Fatalf("expected update to be called")
	}
	if repo.updatedUser.Email != "new@mappening.local" || repo.updatedUser.Role != "admin" {
		t.Fatalf("expected normalized fields, got %+v", repo.updatedUser)
	}
	if repo.updatedUser.FirstName != "Jeanne" || repo.updatedUser.LastName != "Durand" || repo.updatedUser.IsActive {
		t.Fatalf("expected updated user values, got %+v", repo.updatedUser)
	}
	if repo.updatedPasswordID != 4 || repo.updatedPasswordHash == "" {
		t.Fatalf("expected password update call, got id=%d hash=%q", repo.updatedPasswordID, repo.updatedPasswordHash)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(repo.updatedPasswordHash), []byte("newsecret123")); err != nil {
		t.Fatalf("expected updated hash to match password: %v", err)
	}
	if len(sessionStore.deletedSubjects) != 2 {
		t.Fatalf("expected both old and new sessions to be revoked, got %+v", sessionStore.deletedSubjects)
	}
	if sessionStore.deletedSubjects[0] != "user@mappening.local" || sessionStore.deletedSubjects[1] != "new@mappening.local" {
		t.Fatalf("unexpected revoked subjects: %+v", sessionStore.deletedSubjects)
	}
}

func TestAdminHandler_Update_InvalidPasswordDoesNotPersistProfileChanges(t *testing.T) {
	repo := &fakeAdminUserRepo{
		userByID: &User{
			ID:        4,
			Email:     "user@mappening.local",
			FirstName: "Jean",
			LastName:  "Dupont",
			Role:      "user",
			IsActive:  true,
		},
	}
	handler := adminHandler(repo, nil)

	body := []byte(`{"email":"new@mappening.local","password":"short"}`)
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/users/4", bytes.NewReader(body))
	req = withURLParam(req, "userID", "4")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.Update(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", res.StatusCode)
	}
	if repo.updatedUser != nil {
		t.Fatalf("expected profile update not to be persisted on invalid password")
	}
	if repo.updatedPasswordHash != "" {
		t.Fatalf("expected password hash not to be written")
	}
}

func TestAdminHandler_Update_RejectsRemovingOwnActiveAdminAccess(t *testing.T) {
	repo := &fakeAdminUserRepo{
		userByID: &User{
			ID:        4,
			Email:     "admin@mappening.local",
			FirstName: "Admin",
			LastName:  "Mappening",
			Role:      "admin",
			IsActive:  true,
		},
		listUsers: []User{
			{
				ID:        4,
				Email:     "admin@mappening.local",
				FirstName: "Admin",
				LastName:  "Mappening",
				Role:      "admin",
				IsActive:  true,
			},
			{
				ID:        8,
				Email:     "user@mappening.local",
				FirstName: "User",
				LastName:  "Mappening",
				Role:      "user",
				IsActive:  true,
			},
		},
	}
	handler := adminHandler(repo, nil)

	body := []byte(`{"role":"user"}`)
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/users/4", bytes.NewReader(body))
	req = withURLParam(req, "userID", "4")
	req = withCurrentUserID(req, 4)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.Update(rec, req)

	if rec.Result().StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Result().StatusCode)
	}
	if repo.updatedUser != nil {
		t.Fatalf("expected self-demotion to be rejected before persistence")
	}
}

func TestAdminHandler_Update_RejectsRemovingLastActiveAdmin(t *testing.T) {
	repo := &fakeAdminUserRepo{
		userByID: &User{
			ID:        4,
			Email:     "admin@mappening.local",
			FirstName: "Admin",
			LastName:  "Mappening",
			Role:      "admin",
			IsActive:  true,
		},
		listUsers: []User{
			{
				ID:        4,
				Email:     "admin@mappening.local",
				FirstName: "Admin",
				LastName:  "Mappening",
				Role:      "admin",
				IsActive:  true,
			},
		},
	}
	handler := adminHandler(repo, nil)

	body := []byte(`{"is_active":false}`)
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/users/4", bytes.NewReader(body))
	req = withURLParam(req, "userID", "4")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.Update(rec, req)

	if rec.Result().StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Result().StatusCode)
	}
	if repo.updatedUser != nil {
		t.Fatalf("expected last admin deactivation to be rejected before persistence")
	}
}

func TestAdminHandler_Delete_DeletesUser(t *testing.T) {
	repo := &fakeAdminUserRepo{
		userByID: &User{
			ID:    7,
			Email: "delete@mappening.local",
		},
	}
	sessionStore := &fakeSessionStore{}
	handler := adminHandler(repo, sessionStore)

	req := httptest.NewRequest(http.MethodDelete, "/api/admin/users/7", nil)
	req = withURLParam(req, "userID", "7")
	rec := httptest.NewRecorder()

	handler.Delete(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", res.StatusCode)
	}
	if repo.deletedUserID != 7 {
		t.Fatalf("expected delete to target user 7, got %d", repo.deletedUserID)
	}
	if len(sessionStore.deletedSubjects) != 1 || sessionStore.deletedSubjects[0] != "delete@mappening.local" {
		t.Fatalf("expected delete to revoke the active session, got %+v", sessionStore.deletedSubjects)
	}
}

func TestAdminHandler_Delete_RejectsSelfDeletion(t *testing.T) {
	repo := &fakeAdminUserRepo{
		userByID: &User{
			ID:        7,
			Email:     "delete@mappening.local",
			Role:      "admin",
			IsActive:  true,
			FirstName: "Admin",
			LastName:  "Mappening",
		},
		listUsers: []User{
			{
				ID:        7,
				Email:     "delete@mappening.local",
				Role:      "admin",
				IsActive:  true,
				FirstName: "Admin",
				LastName:  "Mappening",
			},
			{
				ID:        9,
				Email:     "other@mappening.local",
				Role:      "admin",
				IsActive:  true,
				FirstName: "Other",
				LastName:  "Admin",
			},
		},
	}
	handler := adminHandler(repo, nil)

	req := httptest.NewRequest(http.MethodDelete, "/api/admin/users/7", nil)
	req = withURLParam(req, "userID", "7")
	req = withCurrentUserID(req, 7)
	rec := httptest.NewRecorder()

	handler.Delete(rec, req)

	if rec.Result().StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Result().StatusCode)
	}
	if repo.deletedUserID != 0 {
		t.Fatalf("expected self-delete to be rejected before persistence")
	}
}

func TestAdminHandler_Delete_RejectsDeletingLastActiveAdmin(t *testing.T) {
	repo := &fakeAdminUserRepo{
		userByID: &User{
			ID:        7,
			Email:     "delete@mappening.local",
			Role:      "admin",
			IsActive:  true,
			FirstName: "Admin",
			LastName:  "Mappening",
		},
		listUsers: []User{
			{
				ID:        7,
				Email:     "delete@mappening.local",
				Role:      "admin",
				IsActive:  true,
				FirstName: "Admin",
				LastName:  "Mappening",
			},
		},
	}
	handler := adminHandler(repo, nil)

	req := httptest.NewRequest(http.MethodDelete, "/api/admin/users/7", nil)
	req = withURLParam(req, "userID", "7")
	rec := httptest.NewRecorder()

	handler.Delete(rec, req)

	if rec.Result().StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Result().StatusCode)
	}
	if repo.deletedUserID != 0 {
		t.Fatalf("expected last admin delete to be rejected before persistence")
	}
}

func TestAdminHandler_ResetPassword_UpdatesPasswordHash(t *testing.T) {
	repo := &fakeAdminUserRepo{
		userByID: &User{
			ID:    5,
			Email: "reset@mappening.local",
		},
	}
	sessionStore := &fakeSessionStore{}
	handler := adminHandler(repo, sessionStore)

	body := []byte(`{"password":"resetpass123"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/users/5/reset-password", bytes.NewReader(body))
	req = withURLParam(req, "userID", "5")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.ResetPassword(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", res.StatusCode)
	}
	if repo.updatedPasswordID != 5 || repo.updatedPasswordHash == "" {
		t.Fatalf("expected reset password to update stored hash, got id=%d hash=%q", repo.updatedPasswordID, repo.updatedPasswordHash)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(repo.updatedPasswordHash), []byte("resetpass123")); err != nil {
		t.Fatalf("expected reset hash to match password: %v", err)
	}
	if len(sessionStore.deletedSubjects) != 1 || sessionStore.deletedSubjects[0] != "reset@mappening.local" {
		t.Fatalf("expected reset password to revoke the active session, got %+v", sessionStore.deletedSubjects)
	}
}

func TestAdminHandler_Create_RejectsPasswordWithOuterWhitespace(t *testing.T) {
	repo := &fakeAdminUserRepo{}
	handler := adminHandler(repo, nil)

	body := []byte(`{"email":"admin@mappening.local","password":" secret123 ","role":"admin","is_active":true}`)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/users", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.Create(rec, req)

	if rec.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Result().StatusCode)
	}
	if repo.createdUser != nil {
		t.Fatalf("expected invalid password to block user creation")
	}
}

func TestAdminHandler_Create_RejectsUnknownRole(t *testing.T) {
	repo := &fakeAdminUserRepo{}
	handler := adminHandler(repo, nil)

	body := []byte(`{"email":"admin@mappening.local","password":"secret123456","role":"superadmin","is_active":true}`)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/users", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.Create(rec, req)

	if rec.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Result().StatusCode)
	}
	if repo.createdUser != nil {
		t.Fatalf("expected invalid role to block user creation")
	}
}

func TestAdminHandler_Create_RejectsInvalidEmailBeforeRepository(t *testing.T) {
	repo := &fakeAdminUserRepo{}
	handler := adminHandler(repo, nil)

	body := []byte(`{"email":"not an email","password":"secret123456","role":"admin","is_active":true}`)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/users", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.Create(rec, req)

	if rec.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Result().StatusCode)
	}
	if repo.createdUser != nil {
		t.Fatalf("expected invalid email to block user creation")
	}
}

func TestAdminHandler_Update_RejectsTooLongNameBeforeRepository(t *testing.T) {
	repo := &fakeAdminUserRepo{
		userByID: &User{
			ID:        4,
			Email:     "user@mappening.local",
			FirstName: "Jean",
			LastName:  "Dupont",
			Role:      "user",
			IsActive:  true,
		},
	}
	handler := adminHandler(repo, nil)

	body := []byte(`{"first_name":"` + strings.Repeat("a", 101) + `"}`)
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/users/4", bytes.NewReader(body))
	req = withURLParam(req, "userID", "4")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.Update(rec, req)

	if rec.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Result().StatusCode)
	}
	if repo.updatedUser != nil {
		t.Fatalf("expected invalid name to block update")
	}
}

func TestAdminHandler_Update_RejectsUnknownRole(t *testing.T) {
	repo := &fakeAdminUserRepo{
		userByID: &User{
			ID:        4,
			Email:     "user@mappening.local",
			FirstName: "Jean",
			LastName:  "Dupont",
			Role:      "user",
			IsActive:  true,
		},
	}
	handler := adminHandler(repo, nil)

	body := []byte(`{"role":"superadmin"}`)
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/users/4", bytes.NewReader(body))
	req = withURLParam(req, "userID", "4")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.Update(rec, req)

	if rec.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Result().StatusCode)
	}
	if repo.updatedUser != nil {
		t.Fatalf("expected invalid role to block update")
	}
}

func TestToAdminUserDTO_FormatsUserResponse(t *testing.T) {
	dto := toAdminUserDTO(User{
		ID:        9,
		Email:     "admin@mappening.local",
		FirstName: "Admin",
		LastName:  "Mappening",
		Role:      "admin",
		IsActive:  true,
	})

	if dto.ID != 9 || dto.Email != "admin@mappening.local" || dto.Role != "admin" {
		t.Fatalf("unexpected dto values: %+v", dto)
	}
	if dto.FirstName != "Admin" || dto.LastName != "Mappening" || !dto.IsActive {
		t.Fatalf("unexpected dto identity fields: %+v", dto)
	}
}

func TestIsAllowedRole_MatchesFrontendRoles(t *testing.T) {
	for _, role := range []string{"user", "admin", "moderator", "organization"} {
		if !isAllowedRole(role) {
			t.Fatalf("expected role %q to be allowed", role)
		}
	}

	if isAllowedRole("member") {
		t.Fatal("expected legacy role member to be rejected")
	}
}
