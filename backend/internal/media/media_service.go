package media

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"strings"
)

type Service struct {
	Repo    *Repository
	Storage Storage
}

func (s Service) Upload(ctx context.Context, actor Actor, request UploadRequest, file multipart.File, header *multipart.FileHeader) (*Media, error) {
	entityType, err := normalizeEntityType(request.EntityType)
	if err != nil {
		return nil, err
	}
	if actor.AccountID <= 0 {
		return nil, ErrForbidden
	}

	if err := s.authorizeUpload(ctx, actor, entityType, request.EntityID, request.OrganizationID); err != nil {
		return nil, err
	}
	processed, err := ProcessImage(file, header)
	if err != nil {
		return nil, err
	}

	directory := entityDirectory(entityType)
	storage := s.Storage
	if storage == nil {
		storage = NewLocalStorage("uploads")
	}
	stored, err := storage.Save(ctx, directory, processed.FileName, processed.Data)
	if err != nil {
		return nil, err
	}
	if request.EntityID != nil {
		if err := s.repo().SoftDeleteActiveForEntity(ctx, entityType, *request.EntityID); err != nil {
			return nil, err
		}
	}

	ownerID := actor.AccountID
	media, err := s.repo().Create(ctx, Media{
		OwnerAccountID: &ownerID,
		EntityType:     entityType,
		EntityID:       request.EntityID,
		FileName:       stored.FileName,
		FilePath:       stored.FilePath,
		PublicURL:      stored.PublicURL,
		MimeType:       processed.MimeType,
		SizeBytes:      processed.SizeBytes,
	})
	if err != nil {
		return nil, err
	}

	if request.EntityID != nil {
		if err := s.attach(ctx, entityType, *request.EntityID, media.PublicURL); err != nil {
			return nil, err
		}
	}

	return media, nil
}

func (s Service) ReplaceOrganizationLogo(ctx context.Context, actor Actor, organizationID int64, file multipart.File, header *multipart.FileHeader) (*Media, error) {
	if organizationID <= 0 {
		return nil, ErrTargetNotFound
	}
	if err := s.repo().CanManageOrganization(ctx, actor, organizationID, false); err != nil {
		return nil, err
	}
	return s.replaceEntityImage(ctx, actor, "organization", organizationID, nil, file, header)
}

func (s Service) ReplaceEventImage(ctx context.Context, actor Actor, eventID int64, file multipart.File, header *multipart.FileHeader) (*Media, error) {
	if eventID <= 0 {
		return nil, ErrTargetNotFound
	}
	if err := s.repo().CanManageEvent(ctx, actor, eventID); err != nil {
		return nil, err
	}
	return s.replaceEntityImage(ctx, actor, "event", eventID, nil, file, header)
}

func (s Service) Delete(ctx context.Context, actor Actor, mediaID int64) error {
	media, err := s.repo().GetByID(ctx, mediaID)
	if err != nil {
		return err
	}
	if !isAdmin(actor.Role) && (media.OwnerAccountID == nil || *media.OwnerAccountID != actor.AccountID) {
		switch {
		case media.EntityType == "organization" && media.EntityID != nil:
			err = s.repo().CanManageOrganization(ctx, actor, *media.EntityID, false)
		case media.EntityType == "event" && media.EntityID != nil:
			err = s.repo().CanManageEvent(ctx, actor, *media.EntityID)
		default:
			err = ErrForbidden
		}
		if err != nil {
			return err
		}
	}
	if err := s.repo().SoftDelete(ctx, mediaID); err != nil {
		return err
	}
	return s.repo().ClearLinkedURL(ctx, media)
}

func (s Service) replaceEntityImage(
	ctx context.Context,
	actor Actor,
	entityType string,
	entityID int64,
	organizationID *int64,
	file multipart.File,
	header *multipart.FileHeader,
) (*Media, error) {
	media, err := s.Upload(ctx, actor, UploadRequest{
		EntityType:     entityType,
		EntityID:       &entityID,
		OrganizationID: organizationID,
	}, file, header)
	if err != nil {
		return nil, err
	}
	return media, nil
}

func (s Service) authorizeUpload(ctx context.Context, actor Actor, entityType string, entityID *int64, organizationID *int64) error {
	switch entityType {
	case "organization":
		if entityID == nil {
			return nil
		}
		return s.repo().CanManageOrganization(ctx, actor, *entityID, false)
	case "event":
		if entityID != nil {
			return s.repo().CanManageEvent(ctx, actor, *entityID)
		}
		if organizationID == nil || *organizationID <= 0 {
			return ErrTargetNotFound
		}
		return s.repo().CanManageOrganizationMembership(ctx, actor, *organizationID)
	default:
		return ErrUnsupportedEntity
	}
}

func (s Service) attach(ctx context.Context, entityType string, entityID int64, publicURL string) error {
	switch entityType {
	case "organization":
		return s.repo().SetOrganizationLogo(ctx, entityID, publicURL)
	case "event":
		return s.repo().SetEventImage(ctx, entityID, publicURL)
	default:
		return ErrUnsupportedEntity
	}
}

func (s Service) repo() *Repository {
	return s.Repo
}

func normalizeEntityType(value string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "organization", "organizations", "logo":
		return "organization", nil
	case "event", "events", "image":
		return "event", nil
	default:
		return "", ErrUnsupportedEntity
	}
}

func entityDirectory(entityType string) string {
	switch entityType {
	case "organization":
		return "organizations"
	case "event":
		return "events"
	default:
		return "misc"
	}
}

func IsValidationError(err error) bool {
	return errors.Is(err, ErrInvalidImageExtension) ||
		errors.Is(err, ErrInvalidImageMime) ||
		errors.Is(err, ErrImageTooLarge) ||
		errors.Is(err, ErrEmptyImage) ||
		errors.Is(err, ErrMimeMismatch) ||
		errors.Is(err, ErrUnsupportedEntity) ||
		errors.Is(err, ErrTargetNotFound) ||
		errors.Is(err, ErrOrganizationInactive)
}

func publicError(err error) string {
	switch {
	case errors.Is(err, ErrInvalidImageExtension):
		return "image extension must be JPG, PNG or WebP"
	case errors.Is(err, ErrInvalidImageMime):
		return "image must be JPG, PNG or WebP"
	case errors.Is(err, ErrImageTooLarge):
		return "image must be 1MB or smaller"
	case errors.Is(err, ErrEmptyImage):
		return "image is required"
	case errors.Is(err, ErrMimeMismatch):
		return "image extension and MIME type do not match"
	case errors.Is(err, ErrUnsupportedEntity):
		return "unsupported media entity type"
	case errors.Is(err, ErrTargetNotFound):
		return "media target not found"
	case errors.Is(err, ErrOrganizationInactive):
		return "organization is inactive"
	default:
		return fmt.Sprintf("%v", err)
	}
}
