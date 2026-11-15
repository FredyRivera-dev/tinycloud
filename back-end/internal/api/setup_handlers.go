package api

import (
	"errors"
	"net/http"

	"tinycloud/backend/internal/auth"
	"tinycloud/backend/internal/users"
)

// handleSetupStatus is public: it tells the login screen whether the instance
// still needs its first administrator.
func (s *Server) handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	needed, err := s.users.SetupNeeded(r.Context())
	if err != nil {
		s.logger.Error("setup status failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"needs_setup": needed})
}

// handleSetup creates the first administrator and signs them in. It only works
// while the users table is empty; afterwards it returns 409.
func (s *Server) handleSetup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email       string `json:"email"`
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
		Password    string `json:"password"`
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

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		s.logger.Error("hash setup password failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	user, err := s.users.CreateFirstAdmin(
		r.Context(),
		normalizeEmail(req.Email),
		normalizeUsername(req.Username),
		displayName,
		hash,
	)
	if err != nil {
		switch {
		case errors.Is(err, users.ErrSetupComplete):
			writeError(w, http.StatusConflict, "conflict", "Setup has already been completed")
		case errors.Is(err, users.ErrEmailTaken):
			writeError(w, http.StatusConflict, "conflict", "Email already exists")
		case errors.Is(err, users.ErrUsernameTaken):
			writeError(w, http.StatusConflict, "conflict", "Username already exists")
		default:
			s.logger.Error("first admin setup failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		}
		return
	}

	token, err := s.auth.Sign(user.ID, user.Role)
	if err != nil {
		s.logger.Error("jwt sign failed after setup", "error", err, "user_id", user.ID)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	s.logger.Info("first administrator created", "email", user.Email, "username", user.Username)
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "user": user})
}
