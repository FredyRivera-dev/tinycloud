package config

import "testing"

func TestLoadDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://tinycloud:tinycloud@localhost:5433/tinycloud?sslmode=disable")
	t.Setenv("JWT_SECRET", "0123456789abcdef")
	t.Setenv("ADMIN_EMAIL", "")
	t.Setenv("ADMIN_PASSWORD", "")
	t.Setenv("PG_POOL_MAX", "")
	t.Setenv("PG_POOL_MIN", "")
	t.Setenv("PG_POOL_MAX_LIFETIME", "")
	t.Setenv("PG_POOL_MAX_IDLE", "")
	t.Setenv("PG_POOL_HEALTH_PERIOD", "")
	t.Setenv("PG_CONNECT_TIMEOUT", "")
	t.Setenv("STATS_INTERVAL", "")
	t.Setenv("STATS_RETENTION_DAYS", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.DBPoolMax != defaultPoolMax {
		t.Fatalf("max conns = %d", cfg.DBPoolMax)
	}
	if cfg.DBPoolMin != defaultPoolMin {
		t.Fatalf("min conns = %d", cfg.DBPoolMin)
	}
	if cfg.StatsInterval <= 0 || cfg.StatsRetentionDays != 90 {
		t.Fatalf("unexpected stats config: %+v", cfg)
	}
}

func TestLoadRejectsInvalidPoolSizes(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://tinycloud:tinycloud@localhost:5433/tinycloud?sslmode=disable")
	t.Setenv("JWT_SECRET", "0123456789abcdef")
	t.Setenv("PG_POOL_MAX", "2")
	t.Setenv("PG_POOL_MIN", "5")

	if _, err := Load(); err == nil {
		t.Fatal("expected PG_POOL_MIN > PG_POOL_MAX to fail")
	}
}
