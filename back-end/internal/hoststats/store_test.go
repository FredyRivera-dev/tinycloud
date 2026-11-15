package hoststats

import (
	"runtime"
	"testing"
)

func TestReadSample(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("host metrics are read from /proc on Linux")
	}
	sample, err := ReadSample()
	if err != nil {
		t.Fatalf("ReadSample: %v", err)
	}
	if sample.MemTotalMB <= 0 {
		t.Fatalf("mem_total_mb = %v", sample.MemTotalMB)
	}
	if sample.NCPU <= 0 {
		t.Fatalf("ncpu = %v", sample.NCPU)
	}
	if sample.DiskTotalGB <= 0 {
		t.Fatalf("disk_total_gb = %v", sample.DiskTotalGB)
	}
	if sample.CPUUsagePct < 0 || sample.CPUUsagePct > 100 {
		t.Fatalf("cpu_usage_pct = %v", sample.CPUUsagePct)
	}
}

func TestReadSampleAtMissingProc(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("host metrics are read from /proc on Linux")
	}
	if _, err := ReadSampleAt("/nonexistent-proc", "/"); err == nil {
		t.Fatal("expected an error for a missing proc directory")
	}
}
