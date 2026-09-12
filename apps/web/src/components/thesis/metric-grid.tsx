"use client";

import type { Metric } from "@bit-n-build-2026/contracts";

interface MetricGridProps {
  metrics: Metric[];
}

export function MetricGrid({ metrics }: MetricGridProps) {
  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {metrics.map((metric) => (
        <div
          key={metric.key}
          className="p-3 rounded-lg border border-border bg-card/60 space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {metric.label}
            </span>
            {metric.sourceIds?.length > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                [{metric.sourceIds.length} src]
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-foreground">
              {metric.display}
            </span>
            {metric.unit && (
              <span className="text-xs text-muted-foreground">{metric.unit}</span>
            )}
            {metric.direction === "high" && (
              <span className="text-xs font-semibold text-amber-500">↑ High</span>
            )}
            {metric.direction === "low" && (
              <span className="text-xs font-semibold text-blue-500">↓ Low</span>
            )}
          </div>
          {metric.sectorMedian !== null && (
            <p className="text-[11px] text-muted-foreground">
              Sector median: {metric.sectorMedian}
            </p>
          )}
          {metric.explanation && (
            <p className="text-xs text-muted-foreground/90 pt-1 border-t border-border/40">
              {metric.explanation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
