package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultPoolMax            = 10
	defaultPoolMin            = 2
	defaultPoolMaxLifetime    = 30 * time.Minute
	defaultPoolMaxIdle        = 5 * time.Minute
	defaultPoolHealthPeriod   = 30 * time.Second
	defaultPoolConnectTimeout = 10 * time.Second
)

// Config holds every runtime setting for the API. Everything is environment
// driven so the same binary works locally, in docker compose and in a managed
// host.
type Config struct {
	Host               string
	Port               string
	DatabaseURL        string
	JWTSecret          string
	JWTExpiry          time.Duration
	CORSOrigins        []string
	AdminEmail         string
	AdminUsername      string
	AdminDisplayName   string
	AdminPassword      string
	StatsInterval      time.Duration
	StatsRetentionDays int
	HostProc           string
	HostRoot           string

	// Database pool tuning. The defaults are deliberately conservative: one
	// API instance should not exhaust Postgres max_connections, while MinConns
	// keeps a couple of warm connections for the first requests.
	DBPoolMax               int32
	DBPoolMin               int32
	DBPoolMaxConnLifetime   time.Duration
	DBPoolMaxConnIdleTime   time.Duration
	DBPoolHealthCheckPeriod time.Duration
	DBConnectTimeout        time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Host:               env("HOST", "0.0.0.0"),
		Port:               env("PORT", "5950"),
		DatabaseURL:        strings.TrimSpace(os.Getenv("DATABASE_URL")),
		JWTSecret:          strings.TrimSpace(os.Getenv("JWT_SECRET")),
		JWTExpiry:          24 * time.Hour,
		CORSOrigins:        splitList(env("CORS_ORIGIN", "http://localhost:3000,http://127.0.0.1:3000")),
		AdminEmail:         strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL"))),
		AdminUsername:      strings.ToLower(strings.TrimSpace(env("ADMIN_USERNAME", "admin"))),
		AdminDisplayName:   strings.TrimSpace(env("ADMIN_DISPLAY_NAME", "TinyCloud Admin")),
		AdminPassword:      os.Getenv("ADMIN_PASSWORD"),
		StatsInterval:      60 * time.Second,
		StatsRetentionDays: 90,
		HostProc:           env("HOST_PROC", "/proc"),
		HostRoot:           env("HOST_ROOT", "/"),

		DBPoolMax:               defaultPoolMax,
		DBPoolMin:               defaultPoolMin,
		DBPoolMaxConnLifetime:   defaultPoolMaxLifetime,
		DBPoolMaxConnIdleTime:   defaultPoolMaxIdle,
		DBPoolHealthCheckPeriod: defaultPoolHealthPeriod,
		DBConnectTimeout:        defaultPoolConnectTimeout,
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if len(cfg.JWTSecret) < 16 {
		return Config{}, fmt.Errorf("JWT_SECRET must be at least 16 characters")
	}
	if (cfg.AdminEmail == "") != (cfg.AdminPassword == "") {
		return Config{}, fmt.Errorf("ADMIN_EMAIL and ADMIN_PASSWORD must be set together")
	}
	if cfg.AdminEmail != "" && !strings.Contains(cfg.AdminEmail, "@") {
		return Config{}, fmt.Errorf("ADMIN_EMAIL is not a valid email")
	}
	if cfg.AdminUsername == "" {
		cfg.AdminUsername = "admin"
	}
	if cfg.AdminDisplayName == "" {
		cfg.AdminDisplayName = "TinyCloud Admin"
	}
	if cfg.AdminPassword != "" && len(cfg.AdminPassword) < 8 {
		return Config{}, fmt.Errorf("ADMIN_PASSWORD must be at least 8 characters")
	}

	interval, err := time.ParseDuration(env("STATS_INTERVAL", "60s"))
	if err != nil || interval < 5*time.Second {
		return Config{}, fmt.Errorf("STATS_INTERVAL must be a duration of at least 5s")
	}
	cfg.StatsInterval = interval

	retention, err := strconv.Atoi(env("STATS_RETENTION_DAYS", "90"))
	if err != nil || retention < 1 || retention > 3660 {
		return Config{}, fmt.Errorf("STATS_RETENTION_DAYS must be an integer between 1 and 3660")
	}
	cfg.StatsRetentionDays = retention

	poolMax, err := strconv.Atoi(env("PG_POOL_MAX", strconv.Itoa(defaultPoolMax)))
	if err != nil || poolMax < 1 || poolMax > 200 {
		return Config{}, fmt.Errorf("PG_POOL_MAX must be an integer between 1 and 200")
	}
	cfg.DBPoolMax = int32(poolMax)

	poolMin, err := strconv.Atoi(env("PG_POOL_MIN", strconv.Itoa(defaultPoolMin)))
	if err != nil || poolMin < 0 || poolMin > poolMax {
		return Config{}, fmt.Errorf("PG_POOL_MIN must be an integer between 0 and PG_POOL_MAX")
	}
	cfg.DBPoolMin = int32(poolMin)

	cfg.DBPoolMaxConnLifetime, err = parseDurationEnv("PG_POOL_MAX_LIFETIME", defaultPoolMaxLifetime, time.Minute)
	if err != nil {
		return Config{}, err
	}
	cfg.DBPoolMaxConnIdleTime, err = parseDurationEnv("PG_POOL_MAX_IDLE", defaultPoolMaxIdle, time.Second)
	if err != nil {
		return Config{}, err
	}
	cfg.DBPoolHealthCheckPeriod, err = parseDurationEnv("PG_POOL_HEALTH_PERIOD", defaultPoolHealthPeriod, time.Second)
	if err != nil {
		return Config{}, err
	}
	cfg.DBConnectTimeout, err = parseDurationEnv("PG_CONNECT_TIMEOUT", defaultPoolConnectTimeout, time.Second)
	if err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func parseDurationEnv(key string, fallback, minimum time.Duration) (time.Duration, error) {
	raw := env(key, fallback.String())
	d, err := time.ParseDuration(raw)
	if err != nil || d < minimum {
		return 0, fmt.Errorf("%s must be a duration of at least %s", key, minimum)
	}
	return d, nil
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func splitList(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimRight(strings.TrimSpace(p), "/")
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
