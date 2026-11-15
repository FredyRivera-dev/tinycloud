package api

import (
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"tinycloud/backend/internal/hoststats"
)

func (s *Server) handleStatsOverview(w http.ResponseWriter, r *http.Request) {
	var (
		sample    hoststats.Sample
		counts    hoststats.Counts
		sampleErr error
		countsErr error
		wg        sync.WaitGroup
	)

	// Two independent queries: run them concurrently so the dashboard latency
	// is the slower query, not the sum of both.
	wg.Add(2)
	go func() {
		defer wg.Done()
		sample, sampleErr = s.stats.Latest(r.Context())
	}()
	go func() {
		defer wg.Done()
		counts, countsErr = s.stats.Counts(r.Context())
	}()
	wg.Wait()

	if sampleErr != nil {
		if errors.Is(sampleErr, hoststats.ErrNoData) {
			writeError(w, http.StatusServiceUnavailable, "no_data", "No host samples yet")
			return
		}
		s.logger.Error("load latest host sample failed", "error", sampleErr)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	if countsErr != nil {
		s.logger.Error("load stats counts failed", "error", countsErr)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"host":   sample,
		"counts": counts,
	})
}

func (s *Server) handleStatsHistory(w http.ResponseWriter, r *http.Request) {
	days, err := parseQueryInt(r, "days", 7, 1, 90)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	tz := r.URL.Query().Get("tz")
	if tz == "" {
		tz = "UTC"
	}
	if len(tz) > 64 {
		writeError(w, http.StatusBadRequest, "bad_request", "tz is too long")
		return
	}
	if _, err := time.LoadLocation(tz); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", fmt.Sprintf("invalid timezone %q", tz))
		return
	}

	rows, err := s.stats.History(r.Context(), days, tz)
	if err != nil {
		s.logger.Error("load stats history failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal", "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"days": days,
		"tz":   tz,
		"host": rows,
	})
}
