package api

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"tinycloud/backend/internal/auth"
	"tinycloud/backend/internal/config"
	"tinycloud/backend/internal/hoststats"
	"tinycloud/backend/internal/projects"
	"tinycloud/backend/internal/users"
)

type Server struct {
	cfg      config.Config
	db       *pgxpool.Pool
	users    *users.Store
	projects *projects.Store
	stats    *hoststats.Store
	auth     *auth.Manager
	logger   *slog.Logger
	mux      *http.ServeMux
}

func New(
	cfg config.Config,
	db *pgxpool.Pool,
	userStore *users.Store,
	projectStore *projects.Store,
	statsStore *hoststats.Store,
	authManager *auth.Manager,
	logger *slog.Logger,
) *Server {
	s := &Server{
		cfg:      cfg,
		db:       db,
		users:    userStore,
		projects: projectStore,
		stats:    statsStore,
		auth:     authManager,
		logger:   logger,
	}
	s.routes()
	return s
}

func (s *Server) routes() {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", s.handleHealth)

	mux.HandleFunc("POST /auth/login", s.handleLogin)
	mux.HandleFunc("GET /setup/status", s.handleSetupStatus)
	mux.HandleFunc("POST /setup", s.handleSetup)
	mux.Handle("GET /auth/me", s.requireAuth(http.HandlerFunc(s.handleMe)))
	mux.Handle("PATCH /auth/me", s.requireAuth(http.HandlerFunc(s.handleUpdateMe)))

	mux.Handle("GET /users", s.requireAuth(http.HandlerFunc(s.handleSearchUsers)))
	mux.Handle("GET /users/{username}", s.requireAuth(http.HandlerFunc(s.handleGetUser)))

	mux.Handle("GET /admin/users", s.requireAdmin(http.HandlerFunc(s.handleAdminListUsers)))
	mux.Handle("POST /admin/users", s.requireAdmin(http.HandlerFunc(s.handleAdminCreateUser)))
	mux.Handle("DELETE /admin/users/{id}", s.requireAdmin(http.HandlerFunc(s.handleAdminDeleteUser)))

	mux.Handle("GET /projects", s.requireAuth(http.HandlerFunc(s.handleListProjects)))
	mux.Handle("POST /projects", s.requireAdmin(http.HandlerFunc(s.handleCreateProject)))
	mux.Handle("GET /projects/{id}", s.requireAuth(http.HandlerFunc(s.handleGetProject)))
	mux.Handle("PATCH /projects/{id}", s.requireAuth(http.HandlerFunc(s.handleUpdateProject)))
	mux.Handle("DELETE /projects/{id}", s.requireAdmin(http.HandlerFunc(s.handleDeleteProject)))

	mux.Handle("GET /projects/{id}/members", s.requireAuth(http.HandlerFunc(s.handleListMembers)))
	mux.Handle("POST /projects/{id}/members", s.requireAuth(http.HandlerFunc(s.handleAddMember)))
	mux.Handle("PATCH /projects/{id}/members/{userId}", s.requireAuth(http.HandlerFunc(s.handleUpdateMemberRole)))
	mux.Handle("DELETE /projects/{id}/members/{userId}", s.requireAuth(http.HandlerFunc(s.handleRemoveMember)))

	mux.Handle("GET /admin/stats/overview", s.requireAdmin(http.HandlerFunc(s.handleStatsOverview)))
	mux.Handle("GET /admin/stats/history", s.requireAdmin(http.HandlerFunc(s.handleStatsHistory)))

	s.mux = mux
}

func (s *Server) Handler() http.Handler {
	return s.recoverer(s.cors(s.requestLogger(s.timeout(s.mux))))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := contextWithTimeout(r, 2)
	defer cancel()
	if err := s.db.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
