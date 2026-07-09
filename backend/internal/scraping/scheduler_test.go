package scraping

import (
	"testing"
	"time"
)

func TestNextDailyRunSchedulesTodayWhenFuture(t *testing.T) {
	location := time.FixedZone("CET", 3600)
	now := time.Date(2026, time.July, 9, 0, 30, 0, 0, location)

	got := nextDailyRun(now, 1, 0)
	want := time.Date(2026, time.July, 9, 1, 0, 0, 0, location)

	if !got.Equal(want) {
		t.Fatalf("expected %s, got %s", want, got)
	}
}

func TestNextDailyRunSchedulesTomorrowWhenPastOrEqual(t *testing.T) {
	location := time.FixedZone("CET", 3600)
	now := time.Date(2026, time.July, 9, 1, 0, 0, 0, location)

	got := nextDailyRun(now, 1, 0)
	want := time.Date(2026, time.July, 10, 1, 0, 0, 0, location)

	if !got.Equal(want) {
		t.Fatalf("expected %s, got %s", want, got)
	}
}
