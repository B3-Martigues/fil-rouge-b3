package media

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type LocalStorage struct {
	RootDir   string
	PublicDir string
}

func NewLocalStorage(rootDir string) LocalStorage {
	rootDir = strings.TrimSpace(rootDir)
	if rootDir == "" {
		rootDir = "uploads"
	}
	return LocalStorage{
		RootDir:   rootDir,
		PublicDir: "/uploads",
	}
}

func (s LocalStorage) Save(ctx context.Context, directory string, fileName string, data []byte) (StoredFile, error) {
	if err := ctx.Err(); err != nil {
		return StoredFile{}, err
	}

	cleanDirectory := cleanPathPart(directory)
	if cleanDirectory == "" {
		return StoredFile{}, fmt.Errorf("storage directory is required")
	}
	if filepath.Base(fileName) != fileName || strings.TrimSpace(fileName) == "" {
		return StoredFile{}, fmt.Errorf("invalid file name")
	}

	root, err := filepath.Abs(s.RootDir)
	if err != nil {
		return StoredFile{}, fmt.Errorf("resolve upload root: %w", err)
	}
	targetDir := filepath.Join(root, cleanDirectory)
	targetPath := filepath.Join(targetDir, fileName)
	if !isWithin(root, targetPath) {
		return StoredFile{}, fmt.Errorf("invalid upload path")
	}

	if err := os.MkdirAll(targetDir, 0o750); err != nil {
		return StoredFile{}, fmt.Errorf("create upload directory: %w", err)
	}
	if err := os.WriteFile(targetPath, data, 0o640); err != nil {
		return StoredFile{}, fmt.Errorf("write upload: %w", err)
	}

	publicRoot := "/" + strings.Trim(strings.TrimSpace(s.PublicDir), "/")
	publicURL := publicRoot + "/" + cleanDirectory + "/" + fileName

	return StoredFile{
		FileName:  fileName,
		FilePath:  filepath.ToSlash(filepath.Join(s.RootDir, cleanDirectory, fileName)),
		PublicURL: publicURL,
	}, nil
}

func cleanPathPart(value string) string {
	value = filepath.ToSlash(strings.TrimSpace(value))
	value = strings.Trim(value, "/")
	if value == "." || strings.Contains(value, "..") || strings.ContainsAny(value, `:\`) {
		return ""
	}
	return value
}

func isWithin(root string, target string) bool {
	rel, err := filepath.Rel(root, target)
	if err != nil {
		return false
	}
	return rel == "." || (!strings.HasPrefix(rel, ".."+string(filepath.Separator)) && rel != "..")
}
