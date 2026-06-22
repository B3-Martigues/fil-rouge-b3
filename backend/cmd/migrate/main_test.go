package main

import (
	"database/sql"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func TestCloseDB_ClosesOpenHandle(t *testing.T) {
	db, err := sql.Open("pgx", "postgres://user:password@127.0.0.1:5432/mappening?sslmode=disable")
	if err != nil {
		t.Fatalf("open db handle: %v", err)
	}

	closeDB(db)

	if err := db.Ping(); err == nil {
		t.Fatal("expected closed database handle to reject Ping")
	}
}
