package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata"

	"tinycloud/backend/internal/api"
	"tinycloud/backend/internal/auth"
	"tinycloud/backend/internal/config"
	"tinycloud/backend/internal/database"
	"tinycloud/backend/internal/hoststats"
	"tinycloud/backend/internal/projects"
	"tinycloud/backend/internal/users"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := database.Connect(ctx, cfg.DatabaseURL, database.PoolOptions{
		MaxConns:          cfg.DBPoolMax,
		MinConns:          cfg.DBPoolMin,
		MaxConnLifetime:   cfg.DBPoolMaxConnLifetime,
		MaxConnIdleTime:   cfg.DBPoolMaxConnIdleTime,
		HealthCheckPeriod: cfg.DBPoolHealthCheckPeriod,
		ConnectTimeout:    cfg.DBConnectTimeout,
	})
	if err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	logger.Info("database pool configured",
		"max_conns", cfg.DBPoolMax,
		"min_conns", cfg.DBPoolMin,
		"max_lifetime", cfg.DBPoolMaxConnLifetime,
		"max_idle", cfg.DBPoolMaxConnIdleTime,
		"health_check_period", cfg.DBPoolHealthCheckPeriod,
	)

	if err := database.Migrate(ctx, pool); err != nil {
		logger.Error("database migration failed", "error", err)
		os.Exit(1)
	}
	logger.Info("database ready")

	userStore := users.NewStore(pool)
	if cfg.AdminEmail != "" {
		hash, err := auth.HashPassword(cfg.AdminPassword)
		if err != nil {
			logger.Error("bootstrap admin password hash failed", "error", err)
			os.Exit(1)
		}
		created, err := userStore.EnsureAdmin(
			ctx, cfg.AdminEmail, cfg.AdminUsername, cfg.AdminDisplayName, hash,
		)
		if err != nil {
			logger.Error("bootstrap admin failed", "error", err)
			os.Exit(1)
		}
		if created {
			logger.Info("bootstrap admin created", "email", cfg.AdminEmail, "username", cfg.AdminUsername)
		} else {
			logger.Info("bootstrap admin already exists", "email", cfg.AdminEmail)
		}
	} else {
		logger.Warn("ADMIN_EMAIL and ADMIN_PASSWORD are empty: no bootstrap admin was created")
	}

	projectStore := projects.NewStore(pool)
	statsStore := hoststats.NewStore(pool)
	collector := hoststats.NewCollector(statsStore, cfg.StatsInterval, cfg.StatsRetentionDays, cfg.HostProc, cfg.HostRoot, logger)
	collector.Start(ctx)

	authManager := auth.NewManager(cfg.JWTSecret, cfg.JWTExpiry)
	handler := api.New(cfg, pool, userStore, projectStore, statsStore, authManager, logger)

	server := &http.Server{
		Addr:              net.JoinHostPort(cfg.Host, cfg.Port),
		Handler:           handler.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("api listening", "addr", server.Addr)
		serverErr <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	case err := <-serverErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("http server failed", "error", err)
			stop()
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
		_ = server.Close()
	}
	logger.Info("api stopped")
}
