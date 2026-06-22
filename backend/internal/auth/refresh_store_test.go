package auth

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestRefreshStore_SetGetDelete(t *testing.T) {
	s := NewRefreshStore()

	subject := "admin@mappening.local"
	jti := "jti-123"

	if _, ok, err := s.Get(subject); err != nil || ok {
		t.Fatalf("expected empty store at start")
	}

	if err := s.Set(subject, jti); err != nil {
		t.Fatalf("set: %v", err)
	}

	got, ok, err := s.Get(subject)
	if err != nil || !ok {
		t.Fatalf("expected subject to exist after Set")
	}
	if got != jti {
		t.Fatalf("expected jti=%q, got %q", jti, got)
	}

	if err := s.Delete(subject); err != nil {
		t.Fatalf("delete: %v", err)
	}

	if _, ok, err := s.Get(subject); err != nil || ok {
		t.Fatalf("expected subject to be deleted")
	}
}

func TestRefreshStore_Overwrite(t *testing.T) {
	s := NewRefreshStore()
	subject := "admin@mappening.local"

	if err := s.Set(subject, "old"); err != nil {
		t.Fatalf("set old: %v", err)
	}
	if err := s.Set(subject, "new"); err != nil {
		t.Fatalf("set new: %v", err)
	}

	got, ok, err := s.Get(subject)
	if err != nil || !ok {
		t.Fatalf("expected subject to exist")
	}
	if got != "new" {
		t.Fatalf("expected overwrite to 'new', got %q", got)
	}
}

func TestRefreshStore_CompareAndSwapWithExpiry(t *testing.T) {
	s := NewRefreshStore()
	subject := "admin@mappening.local"

	if err := s.SetWithExpiry(subject, "current", time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("set with expiry: %v", err)
	}

	swapped, err := s.CompareAndSwapWithExpiry(subject, "current", "next", time.Now().Add(2*time.Hour))
	if err != nil {
		t.Fatalf("compare and swap: %v", err)
	}
	if !swapped {
		t.Fatalf("expected compare and swap to succeed")
	}

	got, ok, err := s.Get(subject)
	if err != nil || !ok {
		t.Fatalf("expected subject to exist after compare and swap")
	}
	if got != "next" {
		t.Fatalf("expected compare and swap to store 'next', got %q", got)
	}
}

func TestRefreshStore_CompareAndSwapWithExpiry_RejectsStaleJTI(t *testing.T) {
	s := NewRefreshStore()
	subject := "admin@mappening.local"

	if err := s.SetWithExpiry(subject, "current", time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("set with expiry: %v", err)
	}

	swapped, err := s.CompareAndSwapWithExpiry(subject, "stale", "next", time.Now().Add(2*time.Hour))
	if err != nil {
		t.Fatalf("compare and swap: %v", err)
	}
	if swapped {
		t.Fatalf("expected compare and swap to reject stale jti")
	}

	got, ok, err := s.Get(subject)
	if err != nil || !ok {
		t.Fatalf("expected subject to remain present after failed compare and swap")
	}
	if got != "current" {
		t.Fatalf("expected current jti to remain unchanged, got %q", got)
	}
}

func TestRefreshStore_ConcurrentAccess(t *testing.T) {
	// Ce test est surtout utile avec: go test ./... -race
	s := NewRefreshStore()

	const workers = 20
	const iterations = 200

	subject := "admin@mappening.local"
	var wg sync.WaitGroup

	wg.Add(workers)
	for w := 0; w < workers; w++ {
		w := w
		go func() {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				_ = s.Set(subject, fmt.Sprintf("jti-%d-%d", w, i))
				_, _, _ = s.Get(subject)
				if i%50 == 0 {
					_ = s.Delete(subject)
				}
			}
		}()
	}

	wg.Wait()
}

func TestRefreshStore_ExpiresEntries(t *testing.T) {
	s := NewRefreshStore()
	if err := s.SetWithExpiry("admin@mappening.local", "jti-1", time.Now().Add(-time.Second)); err != nil {
		t.Fatalf("set with expiry: %v", err)
	}

	if _, ok, err := s.Get("admin@mappening.local"); err != nil || ok {
		t.Fatalf("expected expired entry to be removed")
	}
}
