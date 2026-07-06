package media

import (
	"context"
	"testing"
)

func TestAuthorizeUploadAllowsAdminUnboundEventUpload(t *testing.T) {
	service := Service{}

	err := service.authorizeUpload(context.Background(), Actor{
		AccountID: 1,
		Role:      "admin",
	}, "event", nil, nil)
	if err != nil {
		t.Fatalf("expected admin event upload without organization to be allowed, got %v", err)
	}
}

func TestAuthorizeUploadRejectsNonAdminUnboundEventUpload(t *testing.T) {
	service := Service{}

	err := service.authorizeUpload(context.Background(), Actor{
		AccountID: 1,
		Role:      "organization",
	}, "event", nil, nil)
	if err != ErrTargetNotFound {
		t.Fatalf("expected %v, got %v", ErrTargetNotFound, err)
	}
}
