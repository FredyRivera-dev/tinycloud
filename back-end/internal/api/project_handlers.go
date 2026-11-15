package api

import (
	"errors"
	"net/http"
	"strings"

	"tinycloud/backend/internal/projects"
	"tinycloud/backend/internal/users"
)

func (s *Server) loadProjectAccess(w http.ResponseWriter, r *http.Request) (projects.Project, *users.User, bool) {
	current := s.currentUser(r)
	if current == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return projects.Project{}, nil, false
	}
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return projects.Project{}, nil, false
	}
	p, err := s.projects.GetForUser(r.Context(), id, current.ID, current.Role)
	if err != nil {
		if errors.Is(err, projects.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Project not found")
			return projects.Project{}, nil, false
		}
		s.logger.Error("load project failed", "error", err, "project_id", id)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return projects.Project{}, nil, false
	}
	return p, current, true
}

func isProjectOwner(p projects.Project) bool {
	return p.MyRole != nil && *p.MyRole == "owner"
}

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	current := s.currentUser(r)
	if current == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}
	list, err := s.projects.ListForUser(r.Context(), current.ID, current.Role)
	if err != nil {
		s.logger.Error("list projects failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	current := s.currentUser(r)
	if current == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}
	var req struct {
		Name        string `json:"name"`
		Slug        string `json:"slug"`
		Description string `json:"description"`
	}
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body")
		return
	}

	name, err := validateProjectName(req.Name)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	slug, err := validateSlug(req.Slug)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if slug == "" {
		slug = projects.GenerateSlug()
	}
	description, err := validateDescription(req.Description)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	project, err := s.projects.Create(r.Context(), name, slug, description, current.ID)
	if err != nil {
		switch {
		case errors.Is(err, projects.ErrNameTaken):
			writeError(w, http.StatusConflict, "conflict", "Project name already exists")
		case errors.Is(err, projects.ErrSlugTaken):
			writeError(w, http.StatusConflict, "conflict", "Project slug already exists")
		default:
			s.logger.Error("create project failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		}
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

func (s *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
	project, _, ok := s.loadProjectAccess(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (s *Server) handleUpdateProject(w http.ResponseWriter, r *http.Request) {
	project, current, ok := s.loadProjectAccess(w, r)
	if !ok {
		return
	}
	if current.Role != "admin" && !isProjectOwner(project) {
		writeError(w, http.StatusForbidden, "forbidden", "Insufficient permissions")
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Slug        *string `json:"slug"`
		Description *string `json:"description"`
	}
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body")
		return
	}
	if req.Name == nil && req.Slug == nil && req.Description == nil {
		writeError(w, http.StatusBadRequest, "bad_request", "nothing to update")
		return
	}
	if req.Slug != nil && current.Role != "admin" {
		writeError(w, http.StatusForbidden, "forbidden", "Only admins can change the project slug")
		return
	}

	var name, slug, description *string
	if req.Name != nil {
		normalized, err := validateProjectName(*req.Name)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		name = &normalized
	}
	if req.Slug != nil {
		normalized, err := validateSlug(*req.Slug)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		if normalized == "" {
			writeError(w, http.StatusBadRequest, "bad_request", "slug cannot be empty")
			return
		}
		slug = &normalized
	}
	if req.Description != nil {
		normalized, err := validateDescription(*req.Description)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		description = &normalized
	}

	err := s.projects.Update(r.Context(), project.ID, name, slug, description)
	if err != nil {
		switch {
		case errors.Is(err, projects.ErrNameTaken):
			writeError(w, http.StatusConflict, "conflict", "Project name already exists")
		case errors.Is(err, projects.ErrSlugTaken):
			writeError(w, http.StatusConflict, "conflict", "Project slug already exists")
		case errors.Is(err, projects.ErrNotFound):
			writeError(w, http.StatusNotFound, "not_found", "Project not found")
		default:
			s.logger.Error("update project failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		}
		return
	}

	updated, err := s.projects.GetForUser(r.Context(), project.ID, current.ID, current.Role)
	if err != nil {
		s.logger.Error("reload project failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	if err := s.projects.SoftDelete(r.Context(), id); err != nil {
		if errors.Is(err, projects.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Project not found")
			return
		}
		s.logger.Error("delete project failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleListMembers(w http.ResponseWriter, r *http.Request) {
	project, _, ok := s.loadProjectAccess(w, r)
	if !ok {
		return
	}
	members, err := s.projects.ListMembers(r.Context(), project.ID)
	if err != nil {
		s.logger.Error("list members failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, members)
}

func (s *Server) handleAddMember(w http.ResponseWriter, r *http.Request) {
	project, current, ok := s.loadProjectAccess(w, r)
	if !ok {
		return
	}
	if current.Role != "admin" && !isProjectOwner(project) {
		writeError(w, http.StatusForbidden, "forbidden", "Insufficient permissions")
		return
	}

	var req struct {
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body")
		return
	}
	userID, ok := pathUUIDValue(w, req.UserID, "user_id")
	if !ok {
		return
	}
	role := strings.TrimSpace(req.Role)
	if role == "" {
		role = "member"
	}
	if role != "owner" && role != "member" {
		writeError(w, http.StatusBadRequest, "bad_request", "role must be owner or member")
		return
	}
	if current.Role != "admin" && role != "member" {
		writeError(w, http.StatusForbidden, "forbidden", "Only admins can add project owners")
		return
	}

	member, err := s.projects.AddMember(r.Context(), project.ID, userID, role)
	if err != nil {
		switch {
		case errors.Is(err, projects.ErrAlreadyMember):
			writeError(w, http.StatusConflict, "conflict", "User is already a member of this project")
		case errors.Is(err, projects.ErrUserNotFound):
			writeError(w, http.StatusNotFound, "not_found", "User not found")
		case errors.Is(err, projects.ErrNotFound):
			writeError(w, http.StatusNotFound, "not_found", "Project not found")
		default:
			s.logger.Error("add member failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		}
		return
	}
	writeJSON(w, http.StatusCreated, member)
}

func (s *Server) handleUpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	project, current, ok := s.loadProjectAccess(w, r)
	if !ok {
		return
	}
	if current.Role != "admin" {
		writeError(w, http.StatusForbidden, "forbidden", "Admin access required")
		return
	}
	userID, ok := pathUUID(w, r, "userId")
	if !ok {
		return
	}
	var req struct {
		Role string `json:"role"`
	}
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body")
		return
	}
	role := strings.TrimSpace(req.Role)
	if role != "owner" && role != "member" {
		writeError(w, http.StatusBadRequest, "bad_request", "role must be owner or member")
		return
	}
	member, err := s.projects.UpdateMemberRole(r.Context(), project.ID, userID, role)
	if err != nil {
		if errors.Is(err, projects.ErrMemberNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Member not found")
			return
		}
		s.logger.Error("update member role failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, member)
}

func (s *Server) handleRemoveMember(w http.ResponseWriter, r *http.Request) {
	project, current, ok := s.loadProjectAccess(w, r)
	if !ok {
		return
	}
	if current.Role != "admin" && !isProjectOwner(project) {
		writeError(w, http.StatusForbidden, "forbidden", "Insufficient permissions")
		return
	}
	userID, ok := pathUUID(w, r, "userId")
	if !ok {
		return
	}

	if current.Role != "admin" {
		target, err := s.projects.Member(r.Context(), project.ID, userID)
		if err != nil {
			if errors.Is(err, projects.ErrMemberNotFound) {
				writeError(w, http.StatusNotFound, "not_found", "Member not found")
				return
			}
			s.logger.Error("load member failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
			return
		}
		if target.ProjectRole == "owner" {
			writeError(w, http.StatusForbidden, "forbidden", "Owners cannot remove other owners")
			return
		}
	}

	if err := s.projects.RemoveMember(r.Context(), project.ID, userID); err != nil {
		if errors.Is(err, projects.ErrMemberNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Member not found")
			return
		}
		s.logger.Error("remove member failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
