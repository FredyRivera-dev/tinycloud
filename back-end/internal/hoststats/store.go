package hoststats

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNoData = errors.New("no host samples yet")

type Sample struct {
	SampledAt      time.Time `json:"sampled_at"`
	Hostname       string    `json:"hostname"`
	CPUUsagePct    float64   `json:"cpu_usage_pct"`
	CPULoad1       float64   `json:"cpu_load_1"`
	CPULoad5       float64   `json:"cpu_load_5"`
	CPULoad15      float64   `json:"cpu_load_15"`
	NCPU           int       `json:"ncpu"`
	MemTotalMB     float64   `json:"mem_total_mb"`
	MemUsedMB      float64   `json:"mem_used_mb"`
	MemAvailableMB float64   `json:"mem_available_mb"`
	DiskTotalGB    float64   `json:"disk_total_gb"`
	DiskUsedGB     float64   `json:"disk_used_gb"`
	UptimeSeconds  int64     `json:"uptime_seconds"`
}

type Counts struct {
	Users    int `json:"users"`
	Projects int `json:"projects"`
	Members  int `json:"members"`
}

type DailySample struct {
	Day           time.Time `json:"day"`
	AvgCPUPct     float64   `json:"avg_cpu_pct"`
	MaxCPUPct     float64   `json:"max_cpu_pct"`
	AvgMemUsedMB  float64   `json:"avg_mem_used_mb"`
	MaxMemUsedMB  float64   `json:"max_mem_used_mb"`
	AvgDiskUsedGB float64   `json:"avg_disk_used_gb"`
	MaxDiskUsedGB float64   `json:"max_disk_used_gb"`
	Samples       int       `json:"samples"`
}

type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

func (s *Store) Insert(ctx context.Context, sample Sample) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO host_samples (
			sampled_at, hostname, cpu_usage_pct, cpu_load_1, cpu_load_5, cpu_load_15,
			ncpu, mem_total_mb, mem_used_mb, mem_available_mb,
			disk_total_gb, disk_used_gb, uptime_seconds
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT (sampled_at) DO NOTHING`,
		sample.SampledAt, sample.Hostname, sample.CPUUsagePct,
		sample.CPULoad1, sample.CPULoad5, sample.CPULoad15, sample.NCPU,
		sample.MemTotalMB, sample.MemUsedMB, sample.MemAvailableMB,
		sample.DiskTotalGB, sample.DiskUsedGB, sample.UptimeSeconds,
	)
	return err
}

func (s *Store) Latest(ctx context.Context) (Sample, error) {
	var sample Sample
	err := s.db.QueryRow(ctx, `
		SELECT sampled_at, hostname, cpu_usage_pct, cpu_load_1, cpu_load_5, cpu_load_15,
		       ncpu, mem_total_mb, mem_used_mb, mem_available_mb,
		       disk_total_gb, disk_used_gb, uptime_seconds
		FROM host_samples
		ORDER BY sampled_at DESC
		LIMIT 1`,
	).Scan(
		&sample.SampledAt, &sample.Hostname, &sample.CPUUsagePct,
		&sample.CPULoad1, &sample.CPULoad5, &sample.CPULoad15, &sample.NCPU,
		&sample.MemTotalMB, &sample.MemUsedMB, &sample.MemAvailableMB,
		&sample.DiskTotalGB, &sample.DiskUsedGB, &sample.UptimeSeconds,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Sample{}, ErrNoData
	}
	return sample, err
}

func (s *Store) Prune(ctx context.Context, retentionDays int) (int64, error) {
	tag, err := s.db.Exec(ctx, `
		DELETE FROM host_samples
		WHERE sampled_at < now() - make_interval(days => $1)`, retentionDays)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (s *Store) Counts(ctx context.Context) (Counts, error) {
	var c Counts
	err := s.db.QueryRow(ctx, `
		SELECT
			(SELECT count(*)::int FROM users),
			(SELECT count(*)::int FROM projects WHERE deleted_at IS NULL),
			(SELECT count(*)::int FROM project_members m
			 JOIN projects p ON p.id = m.project_id WHERE p.deleted_at IS NULL)`,
	).Scan(&c.Users, &c.Projects, &c.Members)
	return c, err
}

// History returns one row per local calendar day. The tz string is an IANA
// timezone name and is validated by the HTTP layer with time.LoadLocation.
func (s *Store) History(ctx context.Context, days int, tz string) ([]DailySample, error) {
	rows, err := s.db.Query(ctx, `
		SELECT (date_trunc('day', sampled_at AT TIME ZONE $1) AT TIME ZONE $1) AS day,
		       COALESCE(AVG(cpu_usage_pct), 0) AS avg_cpu_pct,
		       COALESCE(MAX(cpu_usage_pct), 0) AS max_cpu_pct,
		       COALESCE(AVG(mem_used_mb), 0) AS avg_mem_used_mb,
		       COALESCE(MAX(mem_used_mb), 0) AS max_mem_used_mb,
		       COALESCE(AVG(disk_used_gb), 0) AS avg_disk_used_gb,
		       COALESCE(MAX(disk_used_gb), 0) AS max_disk_used_gb,
		       count(*)::int AS samples
		FROM host_samples
		WHERE sampled_at >= now() - make_interval(days => $2)
		GROUP BY 1
		ORDER BY 1 ASC`, tz, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]DailySample, 0, days)
	for rows.Next() {
		var d DailySample
		if err := rows.Scan(
			&d.Day, &d.AvgCPUPct, &d.MaxCPUPct,
			&d.AvgMemUsedMB, &d.MaxMemUsedMB,
			&d.AvgDiskUsedGB, &d.MaxDiskUsedGB, &d.Samples,
		); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// ReadSample gathers host-only metrics from the local /proc and root
// filesystem. The current collector has no Docker dependency, so this version
// does not need access to the Docker socket.
func ReadSample() (Sample, error) {
	return ReadSampleAt("/proc", "/")
}

// ReadSampleAt is ReadSample with configurable mount points. In the Docker
// stack the host's /proc and / are mounted read-only at /host/proc and /host,
// so the admin dashboard reports real host metrics instead of the cgroup
// limits of the API container.
func ReadSampleAt(procDir, rootDir string) (Sample, error) {
	hostname := readHostname(procDir, rootDir)

	load1, load5, load15, err := readLoadAvg(procDir)
	if err != nil {
		return Sample{}, err
	}
	cpuPct, err := readCPUUsage(procDir)
	if err != nil {
		return Sample{}, err
	}
	memTotal, memAvailable, err := readMemInfo(procDir)
	if err != nil {
		return Sample{}, err
	}
	diskTotal, diskUsed, err := readDiskUsage(rootDir)
	if err != nil {
		return Sample{}, err
	}
	uptime, err := readUptime(procDir)
	if err != nil {
		return Sample{}, err
	}

	return Sample{
		SampledAt:      time.Now().UTC(),
		Hostname:       hostname,
		CPUUsagePct:    cpuPct,
		CPULoad1:       load1,
		CPULoad5:       load5,
		CPULoad15:      load15,
		NCPU:           runtime.NumCPU(),
		MemTotalMB:     memTotal,
		MemUsedMB:      memTotal - memAvailable,
		MemAvailableMB: memAvailable,
		DiskTotalGB:    diskTotal,
		DiskUsedGB:     diskUsed,
		UptimeSeconds:  uptime,
	}, nil
}

type cpuTimes struct {
	idle  uint64
	total uint64
}

// readHostname prefers the mounted host root, which reports the real host name
// even when the API runs in a container (the container's UTS namespace shadows
// /proc/sys/kernel/hostname and os.Hostname).
func readHostname(procDir, rootDir string) string {
	candidates := []string{
		filepath.Join(rootDir, "etc", "hostname"),
		filepath.Join(procDir, "sys", "kernel", "hostname"),
	}
	for _, path := range candidates {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		if hostname := strings.TrimSpace(string(data)); hostname != "" {
			return hostname
		}
	}
	hostname, _ := os.Hostname()
	return hostname
}

func readCPUTimes(procDir string) (cpuTimes, error) {
	data, err := os.ReadFile(filepath.Join(procDir, "stat"))
	if err != nil {
		return cpuTimes{}, err
	}
	for _, line := range bytes.Split(data, []byte("\n")) {
		if !bytes.HasPrefix(line, []byte("cpu ")) {
			continue
		}
		fields := strings.Fields(string(line))
		var t cpuTimes
		for i, field := range fields[1:] {
			v, err := strconv.ParseUint(field, 10, 64)
			if err != nil {
				return cpuTimes{}, err
			}
			t.total += v
			// /proc/stat: user nice system idle iowait irq softirq steal ...
			if i == 3 || i == 4 {
				t.idle += v
			}
		}
		return t, nil
	}
	return cpuTimes{}, fmt.Errorf("/proc/stat has no cpu line")
}

func readCPUUsage(procDir string) (float64, error) {
	first, err := readCPUTimes(procDir)
	if err != nil {
		return 0, err
	}
	time.Sleep(200 * time.Millisecond)
	second, err := readCPUTimes(procDir)
	if err != nil {
		return 0, err
	}
	totalDelta := second.total - first.total
	if totalDelta == 0 {
		return 0, nil
	}
	idleDelta := second.idle - first.idle
	return float64(totalDelta-idleDelta) / float64(totalDelta) * 100, nil
}

func readMemInfo(procDir string) (totalMB, availableMB float64, err error) {
	file, err := os.Open(filepath.Join(procDir, "meminfo"))
	if err != nil {
		return 0, 0, err
	}
	defer file.Close()

	values := map[string]float64{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		switch key {
		case "MemTotal", "MemAvailable", "MemFree", "Buffers", "Cached":
			v, parseErr := strconv.ParseFloat(fields[1], 64)
			if parseErr == nil {
				values[key] = v / 1024 // kB -> MB
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return 0, 0, err
	}

	total := values["MemTotal"]
	available, ok := values["MemAvailable"]
	if !ok {
		available = values["MemFree"] + values["Buffers"] + values["Cached"]
	}
	if total == 0 {
		return 0, 0, fmt.Errorf("/proc/meminfo has no MemTotal")
	}
	if available > total {
		available = total
	}
	return total, available, nil
}

func readDiskUsage(path string) (totalGB, usedGB float64, err error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, 0, err
	}
	blockSize := uint64(stat.Bsize)
	total := stat.Blocks * blockSize
	available := stat.Bavail * blockSize
	if available > total {
		available = total
	}
	return float64(total) / (1024 * 1024 * 1024),
		float64(total-available) / (1024 * 1024 * 1024), nil
}

func readLoadAvg(procDir string) (load1, load5, load15 float64, err error) {
	data, err := os.ReadFile(filepath.Join(procDir, "loadavg"))
	if err != nil {
		return 0, 0, 0, err
	}
	fields := strings.Fields(string(data))
	if len(fields) < 3 {
		return 0, 0, 0, fmt.Errorf("unexpected /proc/loadavg format")
	}
	values := make([]float64, 3)
	for i := 0; i < 3; i++ {
		v, parseErr := strconv.ParseFloat(fields[i], 64)
		if parseErr != nil {
			return 0, 0, 0, parseErr
		}
		values[i] = v
	}
	return values[0], values[1], values[2], nil
}

func readUptime(procDir string) (int64, error) {
	data, err := os.ReadFile(filepath.Join(procDir, "uptime"))
	if err != nil {
		return 0, err
	}
	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return 0, fmt.Errorf("unexpected /proc/uptime format")
	}
	value, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, err
	}
	return int64(value), nil
}
