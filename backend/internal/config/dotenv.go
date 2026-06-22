package config

import (
	"errors"
	"os"

	"github.com/joho/godotenv"
)

// LoadLocalDotEnvFiles ne charge `.env.local` que si l'environnement est
// explicitement de type developpement. Cela conserve la simplicite locale
// sans initialiser par erreur staging ou production a partir d'un `.env`
// present dans le repertoire de travail.
func LoadLocalDotEnvFiles() error {
	for _, path := range []string{".env.local"} {
		if err := loadDevOnlyDotEnv(path); err != nil {
			return err
		}
	}

	return nil
}

// Charge un fichier dotenv seulement s'il reste compatible avec un contexte local/developpement.
func loadDevOnlyDotEnv(path string) error {
	values, err := godotenv.Read(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}

		return err
	}

	runtimeEnv := NormalizeEnv(os.Getenv("ENV"))
	fileEnv := NormalizeEnv(values["ENV"])

	if fileEnv != "" && !IsDevLikeEnv(fileEnv) {
		return nil
	}

	switch {
	case runtimeEnv != "" && !IsDevLikeEnv(runtimeEnv):
		return nil
	case runtimeEnv == "" && !IsDevLikeEnv(fileEnv):
		return nil
	}

	return godotenv.Load(path)
}
