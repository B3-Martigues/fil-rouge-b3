package main

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
)

func main() {
	if len(os.Args) != 1 {
		log.Fatal("usage: go run ./hash_password.go")
	}

	password, err := readPasswordFromTerminalOrStdin(os.Stdin, os.Stderr)
	if err != nil {
		log.Fatal(err)
	}

	hash, err := hashPassword(password)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(hash)
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	return string(hash), nil
}

func readPassword(r io.Reader) (string, error) {
	input, err := bufio.NewReader(r).ReadString('\n')
	if err != nil && err != io.EOF {
		return "", err
	}

	return normalizePasswordInput(input)
}

func readPasswordFromTerminalOrStdin(in *os.File, prompt io.Writer) (string, error) {
	if term.IsTerminal(int(in.Fd())) {
		_, _ = fmt.Fprint(prompt, "Password: ")
		raw, err := term.ReadPassword(int(in.Fd()))
		_, _ = fmt.Fprintln(prompt)
		if err != nil {
			return "", err
		}

		return normalizePasswordInput(string(raw))
	}

	return readPassword(in)
}

func normalizePasswordInput(input string) (string, error) {
	password := strings.TrimRight(input, "\r\n")
	if password == "" {
		return "", fmt.Errorf("password is required on stdin")
	}

	return password, nil
}
