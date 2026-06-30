package main

import (
	"context"
	"database/sql"
	"os"
	"time"

	"github.com/rs/zerolog/log"

	"mappening/internal/config"
	dbx "mappening/internal/db"
	"mappening/internal/logger"
	"mappening/internal/scraping"
)

func main() {
	if err := config.LoadLocalDotEnvFiles(); err != nil {
		log.Error().Err(err).Msg("failed to load local dotenv files")
		os.Exit(1)
	}
	logger.Init(os.Stdout)

	cfg := config.Load()
	if err := cfg.ValidateJobs(); err != nil {
		log.Error().Err(err).Msg("invalid jobs configuration")
		os.Exit(1)
	}

	db, err := dbx.New(cfg.AppDB)
	if err != nil {
		log.Error().Err(err).Msg("database connection failed")
		os.Exit(1)
	}
	defer closeDB(db)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	stats, err := scraping.NewTarpinBienService(db).Run(ctx)
	if err != nil {
		log.Error().Err(err).Msg("tarpin bien scraping failed")
		os.Exit(1)
	}

	log.Info().
		Int("search_pages", stats.SearchPagesVisited).
		Int("detail_pages", stats.DetailPagesVisited).
		Int("inserted", stats.Inserted).
		Int("duplicates", stats.SkippedDuplicates).
		Int("invalid", stats.SkippedInvalid).
		Msg("tarpin bien scraping completed")
}

func closeDB(db *sql.DB) {
	if err := db.Close(); err != nil {
		log.Error().Err(err).Msg("failed to close database")
	}
}
