"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { StockRecord, Metric } from "@bit-n-build-2026/contracts";
import { Card } from "@bit-n-build-2026/ui/components/card";
import { buttonVariants } from "@bit-n-build-2026/ui/components/button";
import { cn } from "@bit-n-build-2026/ui/lib/utils";
import { Loader2, AlertTriangle, ChevronUp, ChevronDown, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@bit-n-build-2026/ui/components/tooltip";

interface CompareTableProps {
  tickers: string[];
}

// The exact order we want to display metrics
const METRIC_ORDER = [
  "pe",
  "market_cap",
  "roe",
  "roce",
  "dividend_yield",
  "debt_to_equity",
  "book_value",
  "eps",
  "previous_close",
  "week52_range"
];

const RISK_ORDER = ["volatility", "valuation", "stability", "debt"];
const RISK_LABELS: Record<string, string> = {
  volatility: "Volatility",
  valuation: "Valuation",
  stability: "Business returns",
  debt: "Debt level"
};

import { CompareChart } from "./compare-chart";

export function CompareTable() {
  const searchParams = useSearchParams();
  const tickersParam = searchParams.get("tickers");
  const tickers = tickersParam ? tickersParam.split(",").filter(Boolean) : [];

  const [records, setRecords] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (tickers.length < 2) {
      setRecords([]);
      return;
    }

    async function fetchAll() {
      setLoading(true);
      setError(false);
      try {
        const promises = tickers.map(ticker =>
          fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/stocks/${ticker}`, {
            credentials: "include"
          }).then(res => res.ok ? res.json() : null)
        );
        const results = await Promise.all(promises);
        setRecords(results.filter(Boolean) as StockRecord[]);
      } catch (err) {
        console.error("Failed to load stocks for table", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [tickersParam]); // Depend on string, not derived array

  if (tickers.length < 2) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground" id="compare-table-section">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || records.length === 0) {
    return (
      <div className="py-8 text-center text-destructive" id="compare-table-section">
        Failed to load comparison data.
      </div>
    );
  }

  const uniqueSectors = Array.from(new Set(records.map(r => r.sector)));
  const sameSector = uniqueSectors.length === 1;
  const sectorName = sameSector ? uniqueSectors[0] : null;

  // We only show the Median column if sameSector is true.
  // We use the first record's sectorMedians as the source of truth.
  const sectorMedians = sameSector ? records[0].sectorMedians : null;

  // Build the metrics to render based on what the companies actually have
  const presentMetricKeys = METRIC_ORDER.filter(key => 
    records.some(r => r.metrics.some(m => m.key === key))
  );

  const presentRiskKeys = RISK_ORDER.filter(key =>
    records.some(r => r.risk.some(rk => rk.key === key))
  );

  const renderIndicator = (direction: Metric["direction"]) => {
    if (direction === "high") return <ChevronUp className="w-3.5 h-3.5 inline-block text-muted-foreground" aria-label="Above sector median" />;
    if (direction === "low") return <ChevronDown className="w-3.5 h-3.5 inline-block text-muted-foreground" aria-label="Below sector median" />;
    if (direction === "normal") return <Minus className="w-3.5 h-3.5 inline-block text-muted-foreground" aria-label="In line with sector median" />;
    return null;
  };

  return (
    <div className="mt-12 space-y-8" id="compare-table-section">
      <CompareChart records={records} />

      {!sameSector && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4 flex gap-3 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm">
            <strong>These are in different sectors</strong> ({uniqueSectors.join(" and ")}). 
            The sector comparisons below are each against their own peers, so the columns don't measure the same thing.
          </p>
        </div>
      )}

      <Card className="overflow-x-auto shadow-sm relative">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-4 font-medium text-muted-foreground min-w-[200px] sticky left-0 z-20 bg-muted/95 backdrop-blur shadow-[1px_0_0_0_hsl(var(--border))]"></th>
              {records.map(r => (
                <th key={r.ticker} className="p-4 min-w-[160px]">
                  <div className="font-bold text-lg">{r.ticker}</div>
                  <div className="text-muted-foreground text-xs font-normal truncate max-w-[180px]">{r.name}</div>
                </th>
              ))}
              {sameSector && (
                <th className="p-4 min-w-[160px] font-medium text-muted-foreground bg-muted/30">
                  {sectorName} median
                </th>
              )}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-border/50 font-variant-numeric tabular-nums">
            {/* What they do */}
            <tr className="hover:bg-muted/10 transition-colors group">
              <td className="p-4 font-medium text-muted-foreground align-top sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors shadow-[1px_0_0_0_hsl(var(--border))]">What they do</td>
              {records.map(r => (
                <td key={r.ticker} className="p-4 align-top">
                  <span className="line-clamp-4 leading-relaxed" title={r.business}>{r.business || "—"}</span>
                </td>
              ))}
              {sameSector && <td className="p-4 bg-muted/10"></td>}
            </tr>

            {/* Current Price */}
            <tr className="hover:bg-muted/10 transition-colors group">
              <td className="p-4 font-medium text-muted-foreground sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors shadow-[1px_0_0_0_hsl(var(--border))]">Price</td>
              {records.map(r => (
                <td key={r.ticker} className="p-4 font-mono font-medium">
                  {r.price?.last ? `₹${r.price.last.toLocaleString()}` : "—"}
                </td>
              ))}
              {sameSector && <td className="p-4 bg-muted/10 text-center">—</td>}
            </tr>
            
            {/* 52-week range */}
            <tr className="hover:bg-muted/10 transition-colors group">
              <td className="p-4 font-medium text-muted-foreground sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors shadow-[1px_0_0_0_hsl(var(--border))]">52-week range</td>
              {records.map(r => (
                <td key={r.ticker} className="p-4 font-mono font-medium">
                  {r.price?.week52Low && r.price?.week52High ? `₹${r.price.week52Low.toLocaleString()} – ₹${r.price.week52High.toLocaleString()}` : "—"}
                </td>
              ))}
              {sameSector && <td className="p-4 bg-muted/10 text-center">—</td>}
            </tr>

            {/* Divider row */}
            <tr>
              <td className="sticky left-0 z-10 bg-muted/30 shadow-[1px_0_0_0_hsl(var(--border))]"></td>
              <td colSpan={sameSector ? records.length + 1 : records.length} className="bg-muted/30 h-1"></td>
            </tr>

            {/* Metrics */}
            {presentMetricKeys.map(key => {
              // Find the first label across all records to use for the row header
              const label = records.find(r => r.metrics.some(m => m.key === key))?.metrics.find(m => m.key === key)?.label || key;
              
              return (
                <tr key={key} className="hover:bg-muted/10 transition-colors group">
                  <td className="p-4 font-medium text-muted-foreground sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors shadow-[1px_0_0_0_hsl(var(--border))]">{label}</td>
                  {records.map(r => {
                    const m = r.metrics.find(m => m.key === key);
                    return (
                      <td key={r.ticker} className="p-4">
                        {m ? (
                          <div className="flex items-center justify-between">
                            <span className="font-mono">{m.display}</span>
                            <span className="ml-2">{renderIndicator(m.direction)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-center block w-full">—</span>
                        )}
                      </td>
                    );
                  })}
                  {sameSector && (
                    <td className="p-4 bg-muted/10 font-mono text-muted-foreground">
                      {sectorMedians?.[key] !== undefined && sectorMedians?.[key] !== null ? sectorMedians[key].toLocaleString() : "—"}
                    </td>
                  )}
                </tr>
              );
            })}

            {/* Divider row */}
            <tr>
              <td className="sticky left-0 z-10 bg-muted/30 shadow-[1px_0_0_0_hsl(var(--border))]"></td>
              <td colSpan={sameSector ? records.length + 1 : records.length} className="bg-muted/30 h-1"></td>
            </tr>

            {/* Risks */}
            {presentRiskKeys.map(key => {
              const label = RISK_LABELS[key] || key;
              return (
                <tr key={key} className="hover:bg-muted/10 transition-colors group">
                  <td className="p-4 font-medium text-muted-foreground sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors shadow-[1px_0_0_0_hsl(var(--border))]">{label}</td>
                  {records.map(r => {
                    const rk = r.risk.find(rk => rk.key === key);
                    return (
                      <td key={r.ticker} className="p-4">
                        {rk ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="capitalize cursor-help border-b border-dashed border-muted-foreground/50">
                                {rk.level}
                              </TooltipTrigger>
                              <TooltipContent className="w-80 p-2">
                                <p className="text-sm font-normal text-muted-foreground text-left">{rk.reason}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                  {sameSector && <td className="p-4 bg-muted/10 text-center">—</td>}
                </tr>
              );
            })}

            {/* Divider row */}
            <tr>
              <td className="sticky left-0 z-10 bg-muted/30 shadow-[1px_0_0_0_hsl(var(--border))]"></td>
              <td colSpan={sameSector ? records.length + 1 : records.length} className="bg-muted/30 h-1"></td>
            </tr>

            {/* Hand-off row (Task 4) */}
            <tr className="bg-primary/5 transition-colors group">
              <td className="p-4 font-medium text-primary/80 sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors shadow-[1px_0_0_0_hsl(var(--border))]">Next steps</td>
              {records.map(r => (
                <td key={r.ticker} className="p-4">
                  <Link 
                    href={`/?q=${encodeURIComponent(`I'm thinking about ${r.ticker} because `)}`}
                    className={cn(buttonVariants({ variant: "default" }), "w-full font-bold inline-flex items-center justify-center gap-2 h-10")}
                  >
                    Thinking about {r.ticker}? Tell us why &rarr;
                  </Link>
                </td>
              ))}
              {sameSector && <td className="p-4 bg-muted/10"></td>}
            </tr>

          </tbody>
        </table>
      </Card>
    </div>
  );
}
