"use client";

import { EChartsRadialChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-radial-chart";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type RadialSegment = {
  name: string;
  label: string;
  /** MB que representa el anillo (se convierte a % del total). */
  value: number;
  color: string;
  darkColor?: string;
};

export type RadialStat = { label: string; value: string };

function useCompactRings() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return compact;
}

const fmtMb = (v: number) => `${Math.round(v).toLocaleString()} MB`;

/**
 * Radial semi-circular data-driven (layout del bloque cache-tiers):
 * anillos = segmentos como % del total, stats al lado, leyenda abajo.
 * Pensado para "cuánta RAM queda vs cuánta se usa".
 */
export function MemoryRadial({
  segments,
  totalMb,
  stats,
  isLoading = false,
  className,
}: {
  segments: RadialSegment[];
  totalMb: number;
  stats: RadialStat[];
  isLoading?: boolean;
  className?: string;
}) {
  const compact = useCompactRings();

  const config = Object.fromEntries(
    segments.map((s) => [
      s.name,
      { label: s.label, colors: { light: [s.color], dark: [s.darkColor ?? s.color] } },
    ]),
  ) as ChartConfig;

  const data = [...segments]
    .reverse()
    .map((s) => ({ name: s.name, share: totalMb > 0 ? (s.value / totalMb) * 100 : 0 }));

  return (
    <div className={cn("flex h-full w-full flex-col gap-2 p-3 sm:gap-3 sm:p-4", className)}>
      <div className="flex min-h-0 flex-1 gap-3 sm:gap-4">
        <div className="relative min-h-0 flex-1 sm:-mb-10">
          <EChartsRadialChart
            data={data}
            config={config}
            nameKey="name"
            variant="semi"
            max={100}
            innerRadius="38%"
            outerRadius="96%"
            className="h-full w-full"
            isLoading={isLoading}
          >
            <EChartsRadialChart.RadialBar
              dataKey="share"
              barSize={compact ? 7 : 13}
              cornerRadius={compact ? 4 : 7}
            />
          </EChartsRadialChart>
        </div>

        <div className="grid shrink-0 grid-cols-2 content-center gap-x-4 gap-y-5 sm:w-[40%] sm:max-w-64">
          {stats.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-muted-foreground truncate text-xs sm:text-sm">{label}</span>
              <span className="text-primary text-lg leading-none font-medium tabular-nums sm:text-xl">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-2 border-t pt-2 sm:grid-cols-4 sm:gap-y-3 sm:pt-3">
        {segments.map((s) => (
          <div key={s.name} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-primary truncate text-xs">{s.label}</span>
            </div>
            <span className="text-muted-foreground text-xs tabular-nums">
              {fmtMb(s.value)}/{fmtMb(totalMb)} ({totalMb > 0 ? Math.round((s.value / totalMb) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
