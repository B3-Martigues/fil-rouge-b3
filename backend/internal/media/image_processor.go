package media

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
)

const MaxImageBytes int64 = 1024 * 1024

var (
	ErrInvalidImageExtension = errors.New("image extension is not allowed")
	ErrInvalidImageMime      = errors.New("image must be JPEG, PNG or WebP")
	ErrImageTooLarge         = errors.New("image must be 1MB or smaller")
	ErrEmptyImage            = errors.New("image is empty")
	ErrMimeMismatch          = errors.New("image MIME type is incoherent")
)

type ProcessedImage struct {
	Data      []byte
	FileName  string
	Extension string
	MimeType  string
	SizeBytes int64
}

func ProcessImage(file multipart.File, header *multipart.FileHeader) (ProcessedImage, error) {
	if header == nil {
		return ProcessedImage{}, ErrEmptyImage
	}
	if header.Size <= 0 {
		return ProcessedImage{}, ErrEmptyImage
	}
	if header.Size > MaxImageBytes {
		return ProcessedImage{}, ErrImageTooLarge
	}

	extension := strings.ToLower(filepath.Ext(header.Filename))
	if !isAllowedExtension(extension) {
		return ProcessedImage{}, ErrInvalidImageExtension
	}

	data, err := io.ReadAll(io.LimitReader(file, MaxImageBytes+1))
	if err != nil {
		return ProcessedImage{}, fmt.Errorf("read image: %w", err)
	}
	if len(data) == 0 {
		return ProcessedImage{}, ErrEmptyImage
	}
	if int64(len(data)) > MaxImageBytes {
		return ProcessedImage{}, ErrImageTooLarge
	}

	detectedMime := detectImageContentType(data)
	expectedExtension, ok := extensionForMime(detectedMime)
	if !ok {
		return ProcessedImage{}, ErrInvalidImageMime
	}
	if !extensionMatchesMime(extension, detectedMime) {
		return ProcessedImage{}, ErrMimeMismatch
	}

	declaredMime := strings.ToLower(strings.TrimSpace(header.Header.Get("Content-Type")))
	if declaredMime != "" && declaredMime != "application/octet-stream" && declaredMime != detectedMime {
		return ProcessedImage{}, ErrMimeMismatch
	}

	fileName, err := randomFileName(expectedExtension)
	if err != nil {
		return ProcessedImage{}, fmt.Errorf("generate file name: %w", err)
	}

	return ProcessedImage{
		Data:      data,
		FileName:  fileName,
		Extension: expectedExtension,
		MimeType:  detectedMime,
		SizeBytes: int64(len(data)),
	}, nil
}

func detectImageContentType(data []byte) string {
	if len(data) >= 12 &&
		bytes.Equal(data[0:4], []byte("RIFF")) &&
		bytes.Equal(data[8:12], []byte("WEBP")) {
		return "image/webp"
	}
	return http.DetectContentType(data)
}

func isAllowedExtension(extension string) bool {
	switch extension {
	case ".jpg", ".jpeg", ".png", ".webp":
		return true
	default:
		return false
	}
}

func extensionForMime(mimeType string) (string, bool) {
	switch mimeType {
	case "image/jpeg":
		return ".jpg", true
	case "image/png":
		return ".png", true
	case "image/webp":
		return ".webp", true
	default:
		return "", false
	}
}

func extensionMatchesMime(extension string, mimeType string) bool {
	switch mimeType {
	case "image/jpeg":
		return extension == ".jpg" || extension == ".jpeg"
	case "image/png":
		return extension == ".png"
	case "image/webp":
		return extension == ".webp"
	default:
		return false
	}
}

func randomFileName(extension string) (string, error) {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes[:]) + extension, nil
}
