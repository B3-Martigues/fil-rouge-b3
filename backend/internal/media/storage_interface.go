package media

import "context"

type StoredFile struct {
	FileName  string
	FilePath  string
	PublicURL string
}

type Storage interface {
	Save(ctx context.Context, directory string, fileName string, data []byte) (StoredFile, error)
}
