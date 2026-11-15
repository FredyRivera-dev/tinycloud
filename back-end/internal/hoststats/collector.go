package hoststats

import (
	"context"
	"log/slog"
	"time"
)

type Collector struct {
	store         *Store
	interval      time.Duration
	retentionDays int
	procDir       string
	rootDir       string
	logger        *slog.Logger
}

func NewCollector(store *Store, interval time.Duration, retentionDays int, procDir, rootDir string, logger *slog.Logger) *Collector {
	return &Collector{
		store:         store,
		interval:      interval,
		retentionDays: retentionDays,
		procDir:       procDir,
		rootDir:       rootDir,
		logger:        logger,
	}
}

func (c *Collector) Start(ctx context.Context) {
	go c.run(ctx)
}

func (c *Collector) run(ctx context.Context) {
	c.collect(ctx)
	c.prune(ctx)

	collectTicker := time.NewTicker(c.interval)
	defer collectTicker.Stop()
	pruneTicker := time.NewTicker(24 * time.Hour)
	defer pruneTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-collectTicker.C:
			c.collect(ctx)
		case <-pruneTicker.C:
			c.prune(ctx)
		}
	}
}

func (c *Collector) collect(ctx context.Context) {
	sample, err := ReadSampleAt(c.procDir, c.rootDir)
	if err != nil {
		c.logger.Warn("could not read host metrics", "error", err)
		return
	}
	if err := c.store.Insert(ctx, sample); err != nil {
		c.logger.Warn("could not store host sample", "error", err)
		return
	}
	c.logger.Debug("host sample collected",
		"cpu_pct", sample.CPUUsagePct,
		"mem_used_mb", sample.MemUsedMB,
		"sampled_at", sample.SampledAt,
	)
}

func (c *Collector) prune(ctx context.Context) {
	deleted, err := c.store.Prune(ctx, c.retentionDays)
	if err != nil {
		c.logger.Warn("could not prune host samples", "error", err)
		return
	}
	if deleted > 0 {
		c.logger.Info("pruned old host samples", "deleted", deleted, "retention_days", c.retentionDays)
	}
}
