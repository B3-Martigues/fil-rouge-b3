package logger

import (
	"io"
	"os"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func Init(out io.Writer) {
	if out == nil {
		out = os.Stdout
	}

	log.Logger = log.Output(zerolog.ConsoleWriter{Out: out})
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
}
