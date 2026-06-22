package main

import (
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestHashPassword_GeneratesUsableBcryptHash(t *testing.T) {
	hash, err := hashPassword("correct horse battery staple")
	if err != nil {
		t.Fatalf("hashPassword returned error: %v", err)
	}

	if hash == "correct horse battery staple" {
		t.Fatal("hashPassword returned the plain password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte("correct horse battery staple")); err != nil {
		t.Fatalf("hash does not match password: %v", err)
	}
}

func TestReadPassword_ReadsFromStdinWithoutKeepingLineBreak(t *testing.T) {
	password, err := readPassword(strings.NewReader("correct horse battery staple\r\n"))
	if err != nil {
		t.Fatalf("readPassword returned error: %v", err)
	}

	if password != "correct horse battery staple" {
		t.Fatalf("unexpected password %q", password)
	}
}

func TestReadPassword_RejectsEmptyInput(t *testing.T) {
	if _, err := readPassword(strings.NewReader("\n")); err == nil {
		t.Fatalf("expected empty password to be rejected")
	}
}
