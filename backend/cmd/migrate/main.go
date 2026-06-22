package main

import (
	"database/sql"
	"os"

	"mappening/internal/config"
	dbx "mappening/internal/db"
	"mappening/internal/logger"

	"github.com/rs/zerolog/log"
)

func main() {
	if err := config.LoadLocalDotEnvFiles(); err != nil {
		log.Error().Err(err).Msg("failed to load local dotenv files")
		os.Exit(1)
	}
	logger.Init(os.Stdout)

	cfg := config.Load()

	if err := cfg.ValidateMigrations(); err != nil {
		log.Error().Err(err).Msg("invalid migrations configuration")
		os.Exit(1)
	}

	db, err := dbx.New(cfg.MigrationsDB)
	if err != nil {
		log.Error().Err(err).Msg("migrations database connection failed")
		os.Exit(1)
	}
	defer closeDB(db)

	log.Info().Msg("migrations database connected")

	if err := dbx.Migrate(db, cfg.MigrationsDB.Name, "./migrations"); err != nil {
		log.Error().Err(err).Msg("database migration failed")
		os.Exit(1)
	}

	log.Info().Msg("database migrated successfully")
}

func closeDB(db *sql.DB) {
	if err := db.Close(); err != nil {
		log.Error().Err(err).Msg("failed to close database")
	}
}
