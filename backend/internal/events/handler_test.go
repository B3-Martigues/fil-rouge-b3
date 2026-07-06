package events

import "testing"

func TestParseDateOrTimeConvertsRFC3339InstantToParisWallClock(t *testing.T) {
	parsed, err := parseDateOrTime("2026-07-03T18:00:00Z")
	if err != nil {
		t.Fatalf("parseDateOrTime returned error: %v", err)
	}

	if got := formatEventDateTimeForDB(parsed); got != "2026-07-03 20:00:00" {
		t.Fatalf("expected Paris summer wall clock 20:00, got %s", got)
	}
}

func TestParseDateOrTimeUsesParisWinterOffsetWithoutHardcodedTwoHours(t *testing.T) {
	parsed, err := parseDateOrTime("2026-01-03T19:00:00Z")
	if err != nil {
		t.Fatalf("parseDateOrTime returned error: %v", err)
	}

	if got := formatEventDateTimeForDB(parsed); got != "2026-01-03 20:00:00" {
		t.Fatalf("expected Paris winter wall clock 20:00, got %s", got)
	}
}

func TestParseDateOrTimeKeepsLocalDateTimeInputUnshifted(t *testing.T) {
	parsed, err := parseDateOrTime("2026-07-03T20:00")
	if err != nil {
		t.Fatalf("parseDateOrTime returned error: %v", err)
	}

	if got := formatEventDateTimeForDB(parsed); got != "2026-07-03 20:00:00" {
		t.Fatalf("expected local wall clock to stay 20:00, got %s", got)
	}
}
