package api

import (
	"errors"
	"net/http"
	"strings"

	"tinycloud/backend/internal/auth"
	"tinycloud/backend/internal/users"
)

type loginRequest struct {
	Identifier string `json:"identifier"`
	Email      string `json:"email"`
	Password   string `json:"password"`
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body")
		return
	}

	identifier := strings.TrimSpace(req.Identifier)
	if identifier == "" {
		identifier = strings.TrimSpace(req.Email)
	}
	if identifier == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "identifier and password are required")
		return
	}

	user, hash, err := s.users.FindForLogin(r.Context(), identifier)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid credentials")
			return
		}
		s.logger.Error("login lookup failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	if !auth.CheckPassword(hash, req.Password) {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid credentials")
		return
	}

	token, err := s.auth.Sign(user.ID, user.Role)
	if err != nil {
		s.logger.Error("jwt sign failed", "error", err, "user_id", user.ID)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": user})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user := s.currentUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	current := s.currentUser(r)
	if current == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}

	var req struct {
		Username    *string `json:"username"`
		DisplayName *string `json:"display_name"`
	}
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body")
		return
	}
	if req.Username == nil && req.DisplayName == nil {
		writeError(w, http.StatusBadRequest, "bad_request", "nothing to update")
		return
	}

	var username *string
	if req.Username != nil {
		if err := validateUsername(*req.Username); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		normalized := normalizeUsername(*req.Username)
		username = &normalized
	}
	var displayName *string
	if req.DisplayName != nil {
		normalized, err := validateDisplayName(*req.DisplayName)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		displayName = &normalized
	}

	updated, err := s.users.UpdateProfile(r.Context(), current.ID, username, displayName)
	if err != nil {
		switch {
		case errors.Is(err, users.ErrUsernameTaken):
			writeError(w, http.StatusConflict, "conflict", "Username already exists")
		case errors.Is(err, users.ErrNotFound):
			writeError(w, http.StatusNotFound, "not_found", "User not found")
		default:
			s.logger.Error("update profile failed", "error", err, "user_id", current.ID)
			writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		}
		return
	}
	writeJSON(w, http.StatusOK, updated)
}
