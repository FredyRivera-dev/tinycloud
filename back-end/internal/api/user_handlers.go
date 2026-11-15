package api

import (
	"errors"
	"net/http"
	"strings"

	"tinycloud/backend/internal/auth"
	"tinycloud/backend/internal/users"
)

func (s *Server) handleSearchUsers(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) > 255 {
		writeError(w, http.StatusBadRequest, "bad_request", "q is too long")
		return
	}
	limit, err := parseQueryInt(r, "limit", 20, 1, 100)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	list, err := s.users.Search(r.Context(), q, limit)
	if err != nil {
		s.logger.Error("search users failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleGetUser(w http.ResponseWriter, r *http.Request) {
	current := s.currentUser(r)
	if current == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}
	username := strings.ToLower(strings.TrimSpace(r.PathValue("username")))
	target, err := s.users.ByUsername(r.Context(), username)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "User not found")
			return
		}
		s.logger.Error("get user failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	if target.ID != current.ID && current.Role != "admin" {
		target.Email = ""
	}
	writeJSON(w, http.StatusOK, target)
}

func (s *Server) handleAdminListUsers(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) > 255 {
		writeError(w, http.StatusBadRequest, "bad_request", "q is too long")
		return
	}
	limit, err := parseQueryInt(r, "limit", 20, 1, 100)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	offset, err := parseQueryInt(r, "offset", 0, 0, 100000)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	list, err := s.users.List(r.Context(), q, limit, offset)
	if err != nil {
		s.logger.Error("list users failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleAdminCreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email       string `json:"email"`
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
		Password    string `json:"password"`
		Role        string `json:"role"`
	}
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body")
		return
	}

	if err := validateEmail(req.Email); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if err := validateUsername(req.Username); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	displayName, err := validateDisplayName(req.DisplayName)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if err := validatePassword(req.Password); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	role := strings.TrimSpace(req.Role)
	if role == "" {
		role = "user"
	}
	if role != "admin" && role != "user" {
		writeError(w, http.StatusBadRequest, "bad_request", "role must be admin or user")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		s.logger.Error("hash password failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	user, err := s.users.Create(r.Context(), normalizeEmail(req.Email), normalizeUsername(req.Username), displayName, hash, role)
	if err != nil {
		switch {
		case errors.Is(err, users.ErrEmailTaken):
			writeError(w, http.StatusConflict, "conflict", "Email already exists")
		case errors.Is(err, users.ErrUsernameTaken):
			writeError(w, http.StatusConflict, "conflict", "Username already exists")
		default:
			s.logger.Error("create user failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		}
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

func (s *Server) handleAdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	current := s.currentUser(r)
	if current == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	if id == current.ID {
		writeError(w, http.StatusBadRequest, "bad_request", "You cannot delete your own account")
		return
	}

	err := s.users.Delete(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, users.ErrNotFound):
			writeError(w, http.StatusNotFound, "not_found", "User not found")
		case errors.Is(err, users.ErrLastAdmin):
			writeError(w, http.StatusConflict, "conflict", "Cannot delete the last admin")
		default:
			s.logger.Error("delete user failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
