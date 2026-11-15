"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  getStatsHistory,
  getStatsOverview,
  type StatsHistory,
  type StatsOverview,
} from "@/lib/api";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatsAreaChart, type StatsChartSeries } from "@/components/stats/StatsAreaChart";
import { MemoryRadial } from "@/components/stats/MemoryRadial";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, RefreshDouble, Refresh } from "iconoir-react";

const PURPLE = "#8b5cf6";
const PURPLE_LIGHT = "#c4b5fd";

function formatDay(day: string): string {
  const d = new Date(day.includes("T") ? day : `${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function fmtMb(value: number): string {
  return `${Math.round(value).toLocaleString()} MB`;
}

function fmtGb(value: number): string {
  return `${value.toFixed(1)} GB`;
}

function latestOf(rows: Record<string, unknown>[], key: string): number {
  const last = rows[rows.length - 1];
  return last ? Number(last[key]) || 0 : 0;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  const [overview, setOverview] = useState<StatsOverview | null | undefined>(undefined);
  const [history, setHistory] = useState<StatsHistory | null>(null);
  const [days, setDays] = useState("7");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (token === null) {
      const timer = setTimeout(() => {
        const s = useAuthStore.getState();
        if (!s.token) router.replace("/login");
        else if (s.role !== "admin") router.replace("/home");
      }, 100);
      return () => clearTimeout(timer);
    }
    if (!token) router.replace("/login");
    else if (role !== "admin") router.replace("/home");
  }, [token, role, router]);

  const loadSnapshot = useCallback(async () => {
    try {
      const ov = await getStatsOverview();
      setOverview(ov);
      setFetchError(null);
      setLastUpdated(new Date());
    } catch (e) {
      const status = (e as unknown as { status?: number }).status;
      if (status === 503) {
        // The collector has not written its first sample yet.
        setOverview(null);
        setFetchError(null);
        return;
      }
      setFetchError(e instanceof Error ? e.message : "Failed to load stats");
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const h = await getStatsHistory({ days: Number(days), tz });
      setHistory(h);
      setLastUpdated(new Date());
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load history");
    }
  }, [days]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([loadSnapshot(), loadHistory()]);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!token || role !== "admin") return;
    let cancelled = false;
    async function poll() {
      try {
        const ov = await getStatsOverview();
        if (cancelled) return;
        setOverview(ov);
        setFetchError(null);
        setLastUpdated(new Date());
      } catch (e) {
        if (cancelled) return;
        const status = (e as unknown as { status?: number }).status;
        if (status === 503) {
          // The collector has not written its first sample yet.
          setOverview(null);
          setFetchError(null);
          return;
        }
        setFetchError(e instanceof Error ? e.message : "Failed to load stats");
      }
    }
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, role]);

  useEffect(() => {
    if (!token || role !== "admin") return;
    let cancelled = false;
    async function load() {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const h = await getStatsHistory({ days: Number(days), tz });
        if (cancelled) return;
        setHistory(h);
        setLastUpdated(new Date());
      } catch (e) {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : "Failed to load history");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, role, days]);

  const chartData = useMemo(() => {
    return (history?.host ?? []).map((row) => ({
      day: row.day,
      avg_cpu: Math.round(row.avg_cpu_pct * 10) / 10,
      max_cpu: Math.round(row.max_cpu_pct * 10) / 10,
      avg_mem: Math.round(row.avg_mem_used_mb),
      max_mem: Math.round(row.max_mem_used_mb),
      avg_disk: Math.round(row.avg_disk_used_gb * 10) / 10,
      max_disk: Math.round(row.max_disk_used_gb * 10) / 10,
    }));
  }, [history]);

  const cpuSeries = useMemo<StatsChartSeries[]>(
    () => [
      { key: "avg_cpu", label: "Average", color: PURPLE, latest: latestOf(chartData, "avg_cpu") },
      { key: "max_cpu", label: "Peak", color: PURPLE_LIGHT, latest: latestOf(chartData, "max_cpu") },
    ],
    [chartData]
  );
  const memSeries = useMemo<StatsChartSeries[]>(
    () => [
      { key: "avg_mem", label: "Average", color: PURPLE, latest: latestOf(chartData, "avg_mem") },
      { key: "max_mem", label: "Peak", color: PURPLE_LIGHT, latest: latestOf(chartData, "max_mem") },
    ],
    [chartData]
  );
  const diskSeries = useMemo<StatsChartSeries[]>(
    () => [
      { key: "avg_disk", label: "Average", color: PURPLE, latest: latestOf(chartData, "avg_disk") },
      { key: "max_disk", label: "Peak", color: PURPLE_LIGHT, latest: latestOf(chartData, "max_disk") },
    ],
    [chartData]
  );

  const memoryRadial = useMemo(() => {
    if (!overview) return null;
    const { mem_total_mb: total, mem_used_mb: used } = overview.host;
    const free = Math.max(0, total - used);
    return {
      total,
      segments: [
        { name: "used", label: "Used", value: used, color: PURPLE, darkColor: PURPLE_LIGHT },
        { name: "free", label: "Available", value: free, color: "#94a3b8", darkColor: "#64748b" },
      ],
      stats: [
        { label: "Used (RAM)", value: fmtMb(used) },
        { label: "Available (RAM)", value: fmtMb(free) },
      ],
    };
  }, [overview]);

  if (token === null && overview === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshDouble className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshDouble className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const warmingUp = overview === null;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar active="stats" />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppHeader title="Stats" description="Host resource usage" />
        <main className="flex-1 bg-background">
          <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-6 lg:px-6">
            {fetchError && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <span className="min-w-0 break-words">{fetchError}</span>
                <Button variant="outline" size="xs" className="shrink-0" onClick={() => void handleRefresh()}>
                  Retry
                </Button>
              </div>
            )}

            {warmingUp ? (
              <section className="flex flex-col items-center px-6 py-20 text-center sm:py-32">
                <Clock className="h-20 w-20" strokeWidth={1} />
                <h3 className="mt-8 text-2xl font-semibold tracking-tight">Collecting samples</h3>
                <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                  The host collector records a sample every minute. This page will populate automatically.
                </p>
              </section>
            ) : (
              <>
                <section className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold tracking-tight">Host snapshot</h3>
                      <p className="text-xs text-muted-foreground">
                        Latest sample from {overview?.host.hostname ?? "the host machine"}.
                        {lastUpdated && (
                          <>
                            {" "}Updated at{" "}
                            {lastUpdated.toLocaleString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                            .
                          </>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={refreshing}
                      className="shrink-0 gap-1.5"
                    >
                      <Refresh className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>

                  {overview === undefined ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
                      {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-card p-5">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
                        <Kpi
                          label="CPU"
                          value={`${overview.host.cpu_usage_pct.toFixed(1)}%`}
                          sub={`load ${overview.host.cpu_load_1.toFixed(2)} · ${overview.host.ncpu} cores`}
                        />
                        <Kpi
                          label="RAM"
                          value={fmtMb(overview.host.mem_used_mb)}
                          sub={`of ${fmtMb(overview.host.mem_total_mb)}`}
                        />
                        <Kpi
                          label="Disk"
                          value={fmtGb(overview.host.disk_used_gb)}
                          sub={`of ${fmtGb(overview.host.disk_total_gb)}`}
                        />
                        <Kpi label="Uptime" value={formatUptime(overview.host.uptime_seconds)} sub="since last boot" />
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                        <span className="rounded-md bg-muted px-2 py-1">
                          <span className="font-medium text-foreground">{overview.counts.users}</span> users
                        </span>
                        <span className="rounded-md bg-muted px-2 py-1">
                          <span className="font-medium text-foreground">{overview.counts.projects}</span> projects
                        </span>
                        <span className="rounded-md bg-muted px-2 py-1">
                          <span className="font-medium text-foreground">{overview.counts.members}</span> memberships
                        </span>
                        <span className="rounded-md bg-muted px-2 py-1">
                          load 5m: <span className="font-medium text-foreground">{overview.host.cpu_load_5.toFixed(2)}</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {overview && (
                    <div className="rounded-lg border border-border">
                      {memoryRadial ? (
                        <MemoryRadial
                          segments={memoryRadial.segments}
                          totalMb={memoryRadial.total}
                          stats={memoryRadial.stats}
                          className="h-64 sm:h-72"
                        />
                      ) : (
                        <Skeleton className="h-64 w-full sm:h-72" />
                      )}
                    </div>
                  )}
                </section>

                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold tracking-tight">History</h3>
                      <p className="text-xs text-muted-foreground">
                        Daily averages and peaks. Samples are taken every 60 seconds and kept for 90 days.
                      </p>
                    </div>
                    <Select value={days} onValueChange={(v) => setDays(v ?? "7")}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="14">Last 14 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {!history ? (
                    <div className="space-y-4">
                      <Skeleton className="h-64 w-full sm:h-72" />
                      <Skeleton className="h-64 w-full sm:h-72" />
                    </div>
                  ) : chartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
                      <Clock className="h-5 w-5" />
                      <p className="mt-2 text-sm font-medium">No samples in this range</p>
                      <p className="text-xs text-muted-foreground">
                        The collector will add a point after its next sample.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div>
                        <h4 className="mb-2 text-xs font-medium text-muted-foreground">CPU usage (%)</h4>
                        <StatsAreaChart
                          series={cpuSeries}
                          data={chartData}
                          xKey="day"
                          unit="%"
                          className="h-64 sm:h-72"
                          xTickFormatter={(v) => formatDay(v)}
                          yTickFormatter={(v) => `${v}`}
                        />
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-medium text-muted-foreground">RAM used (MB)</h4>
                        <StatsAreaChart
                          series={memSeries}
                          data={chartData}
                          xKey="day"
                          unit="MB"
                          className="h-64 sm:h-72"
                          xTickFormatter={(v) => formatDay(v)}
                          yTickFormatter={(v) => `${v}`}
                        />
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-medium text-muted-foreground">Disk used (GB)</h4>
                        <StatsAreaChart
                          series={diskSeries}
                          data={chartData}
                          xKey="day"
                          unit="GB"
                          className="h-64 sm:h-72"
                          xTickFormatter={(v) => formatDay(v)}
                          yTickFormatter={(v) => `${v}`}
                        />
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
