package media

type UploadRequest struct {
	EntityType     string
	EntityID       *int64
	OrganizationID *int64
}

type UploadResponse struct {
	ID        int64  `json:"id"`
	URL       string `json:"url"`
	PublicURL string `json:"public_url"`
	MimeType  string `json:"mime_type"`
	SizeBytes int64  `json:"size_bytes"`
}

func responseFromMedia(media *Media) UploadResponse {
	if media == nil {
		return UploadResponse{}
	}
	return UploadResponse{
		ID:        media.ID,
		URL:       media.PublicURL,
		PublicURL: media.PublicURL,
		MimeType:  media.MimeType,
		SizeBytes: media.SizeBytes,
	}
}
