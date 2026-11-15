package api

import (
	"strings"
	"testing"
)

func TestValidateEmail(t *testing.T) {
	valid := []string{"admin@tinycloud.local", "a.b+c@example.com", " USER@Example.COM "}
	for _, value := range valid {
		if err := validateEmail(value); err != nil {
			t.Fatalf("validateEmail(%q): %v", value, err)
		}
	}
	invalid := []string{"", "not-an-email", "a@b", "@example.com", "a b@example.com"}
	for _, value := range invalid {
		if err := validateEmail(value); err == nil {
			t.Fatalf("validateEmail(%q) should fail", value)
		}
	}
}

func TestValidateUsername(t *testing.T) {
	// Uppercase input is normalized to lowercase instead of rejected.
	valid := []string{"ada", "ada.lovelace", "user_01", "a-b-c", "Ada"}
	for _, value := range valid {
		if err := validateUsername(value); err != nil {
			t.Fatalf("validateUsername(%q): %v", value, err)
		}
	}
	invalid := []string{"", "ab", "user name", "user@name", "this-username-is-way-too-long-xx"}
	for _, value := range invalid {
		if err := validateUsername(value); err == nil {
			t.Fatalf("validateUsername(%q) should fail", value)
		}
	}
}

func TestValidateSlug(t *testing.T) {
	// Uppercase input is normalized to lowercase instead of rejected.
	valid := []string{"", "project-aurora-7k2q", "abc", "a-b-c", "Project"}
	for _, value := range valid {
		slug, err := validateSlug(value)
		if err != nil {
			t.Fatalf("validateSlug(%q): %v", value, err)
		}
		if value != "" && slug != strings.ToLower(value) {
			t.Fatalf("validateSlug(%q) = %q", value, slug)
		}
	}
	invalid := []string{"ab", "project_1", "a b", "this-slug-is-way-too-long-for-the-schema-x"}
	for _, value := range invalid {
		if _, err := validateSlug(value); err == nil {
			t.Fatalf("validateSlug(%q) should fail", value)
		}
	}
}

func TestValidateDescription(t *testing.T) {
	if _, err := validateDescription("hello"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	long := make([]byte, 1001)
	for i := range long {
		long[i] = 'a'
	}
	if _, err := validateDescription(string(long)); err == nil {
		t.Fatal("expected long description to fail")
	}
}
