package api

import (
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"tinycloud/backend/internal/projects"
)

var (
	emailRegex    = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	usernameRegex = regexp.MustCompile(`^[a-z0-9._-]{3,30}$`)
)

func normalizeEmail(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func normalizeUsername(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func validateEmail(raw string) error {
	email := normalizeEmail(raw)
	if email == "" {
		return fmt.Errorf("email is required")
	}
	if len(email) > 255 || !emailRegex.MatchString(email) {
		return fmt.Errorf("invalid email format")
	}
	return nil
}

func validateUsername(raw string) error {
	username := normalizeUsername(raw)
	if username == "" {
		return fmt.Errorf("username is required")
	}
	if !usernameRegex.MatchString(username) {
		return fmt.Errorf("username must be 3-30 chars: lowercase letters, numbers, . _ -")
	}
	return nil
}

func validateDisplayName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "", fmt.Errorf("display name is required")
	}
	if len(name) > 100 {
		return "", fmt.Errorf("display name must be 100 characters or less")
	}
	return name, nil
}

func validatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}
	if len(password) > 255 {
		return fmt.Errorf("password must be 255 characters or less")
	}
	return nil
}

func validateProjectName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "", fmt.Errorf("project name is required")
	}
	if len(name) > 100 {
		return "", fmt.Errorf("project name must be 100 characters or less")
	}
	return name, nil
}

func validateDescription(raw string) (string, error) {
	description := strings.TrimSpace(raw)
	if len(description) > 1000 {
		return "", fmt.Errorf("description must be 1000 characters or less")
	}
	return description, nil
}

func validateSlug(raw string) (string, error) {
	slug := strings.ToLower(strings.TrimSpace(raw))
	if slug == "" {
		return "", nil
	}
	if !projects.SlugRegex.MatchString(slug) {
		return "", fmt.Errorf("slug must be 3-40 chars: lowercase letters, numbers and hyphens")
	}
	return slug, nil
}

func parseQueryInt(r *http.Request, key string, fallback, min, max int) (int, error) {
	raw := strings.TrimSpace(r.URL.Query().Get(key))
	if raw == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < min || n > max {
		return 0, fmt.Errorf("%s must be between %d and %d", key, min, max)
	}
	return n, nil
}

func pathUUID(w http.ResponseWriter, r *http.Request, name string) (string, bool) {
	return pathUUIDValue(w, r.PathValue(name), name)
}

func pathUUIDValue(w http.ResponseWriter, raw, name string) (string, bool) {
	if _, err := uuid.Parse(raw); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid "+name)
		return "", false
	}
	return raw, true
}
