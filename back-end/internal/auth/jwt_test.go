package auth

import (
	"testing"
	"time"
)

func TestSignAndVerify(t *testing.T) {
	m := NewManager("0123456789abcdef", time.Hour)
	token, err := m.Sign("6f0f6a7e-4d3e-4f5a-8f1a-2b3c4d5e6f70", "admin")
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	claims, err := m.Verify(token)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if claims.Subject != "6f0f6a7e-4d3e-4f5a-8f1a-2b3c4d5e6f70" {
		t.Fatalf("subject = %q", claims.Subject)
	}
	if claims.Role != "admin" {
		t.Fatalf("role = %q", claims.Role)
	}
}

func TestVerifyRejectsWrongSecret(t *testing.T) {
	first := NewManager("0123456789abcdef", time.Hour)
	second := NewManager("fedcba9876543210", time.Hour)
	token, err := first.Sign("u1", "user")
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	if _, err := second.Verify(token); err == nil {
		t.Fatal("expected verification to fail with a different secret")
	}
}

func TestVerifyRejectsExpiredToken(t *testing.T) {
	m := NewManager("0123456789abcdef", -time.Minute)
	token, err := m.Sign("u1", "user")
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	if _, err := m.Verify(token); err == nil {
		t.Fatal("expected expired token to be rejected")
	}
}
