package logger

import (
	"bytes"
	"testing"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func TestInit_SetsInfoLevel_AndAllowsLogging(t *testing.T) {
	prevLogger := log.Logger
	prevLevel := zerolog.GlobalLevel()

	t.Cleanup(func() {
		log.Logger = prevLogger
		zerolog.SetGlobalLevel(prevLevel)
	})

	var buf bytes.Buffer
	Init(&buf)

	if zerolog.GlobalLevel() != zerolog.InfoLevel {
		t.Fatalf("expected global level Info, got %v", zerolog.GlobalLevel())
	}

	log.Info().Msg("hello")
	if buf.Len() == 0 {
		t.Fatalf("expected logger to write output")
	}
}
