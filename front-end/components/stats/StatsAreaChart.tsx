"use client";

import { useState } from "react";
import {
  EChartsAreaChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-area-chart";
import { cn } from "@/lib/utils";

export type StatsChartSeries = {
  key: string;
  label: string;
  color: string;
  latest: number;
};

type Props = {
  series: StatsChartSeries[];
  data: Record<string, unknown>[];
  xKey: string;
  /** Unidad que se muestra junto al valor actual (p. ej. "MB", "%"). */
  unit?: string;
  /** Etiqueta del eje X (p. ej. "Day"). */
  xLabel?: string;
  /** Formatea los ticks del eje X. */
  xTickFormatter?: (value: string, index: number) => string;
  /** Formatea los ticks del eje Y. */
  yTickFormatter?: (value: number, index: number) => string;
  isLoading?: boolean;
  className?: string;
};

const FONT_STACK = "Geist, ui-sans-serif, system-ui, sans-serif";

export function StatsAreaChart({
  series,
  data,
  xKey,
  unit,
  xLabel,
  xTickFormatter,
  yTickFormatter,
  isLoading,
  className,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, colors: { light: [s.color], dark: [s.color] } }]),
  ) as ChartConfig;

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      <div className="grid grid-cols-2 gap-y-2 sm:grid-cols-4 sm:gap-y-4">
        {series.map(({ key, label, color, latest }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelected((prev) => (prev === key ? null : key))}
            className={cn(
              "border-border flex cursor-pointer flex-row items-center gap-1.5 px-3 text-left transition-opacity sm:flex-col sm:items-start sm:gap-1.5 sm:px-4 sm:first:pl-1 sm:[&:not(:first-child)]:border-l [&:nth-child(even)]:border-l",
              selected !== null && selected !== key && "opacity-40",
            )}
          >
            <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary sm:gap-2">
              <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
              <span className="truncate">{label}</span>
            </div>
            <span className="text-xs text-muted-foreground sm:hidden">–</span>
            <div className="leading-none">
              <span className="text-sm font-medium tracking-tight text-primary sm:text-xl">
                {Number.isInteger(latest) ? String(latest) : latest.toFixed(1)}
              </span>
              {unit && (
                <span className="ml-0.5 text-xs font-light text-muted-foreground sm:ml-1 sm:text-sm">
                  {unit}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      <EChartsAreaChart
        data={data}
        config={config}
        xDataKey={xKey}
        className="mt-4 min-h-0 w-full flex-1"
        curveType="linear"
        enableHoverHighlight
        selectedDataKey={selected}
        onSelectionChange={setSelected}
        isLoading={isLoading}
        chartOptions={{
          textStyle: { fontFamily: FONT_STACK },
        }}
      >
        <EChartsAreaChart.Grid />
        <EChartsAreaChart.XAxis dataKey={xKey} label={xLabel} tickFormatter={xTickFormatter} />
        <EChartsAreaChart.YAxis tickFormatter={yTickFormatter} />
        <EChartsAreaChart.Tooltip />
        {series.map((s) => (
          <EChartsAreaChart.Area
            key={s.key}
            dataKey={s.key}
            variant="gradient"
            strokeVariant="solid"
            isClickable
          />
        ))}
      </EChartsAreaChart>
    </div>
  );
}
