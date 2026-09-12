"use client";

import type { StockRecord } from "@bit-n-build-2026/contracts";
import { Card } from "@bit-n-build-2026/ui/components/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface CompareChartProps {
  records: StockRecord[];
}

const CHART_COLORS = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--chart-3)",
];

export function CompareChart({ records }: CompareChartProps) {
  if (records.length === 0) return null;

  // Ensure all companies have history
  if (records.some(r => !r.history || r.history.length === 0)) {
    return null;
  }

  // 1. Gather all unique dates across all records
  const dateSet = new Set<string>();
  records.forEach(r => {
    r.history.forEach(p => dateSet.add(p.date));
  });
  
  // Sort dates chronologically
  const sortedDates = Array.from(dateSet).sort();

  // 2. Find baseline prices (the first available price for each ticker)
  const baselines: Record<string, number> = {};
  records.forEach(r => {
    // Find earliest price
    const firstPoint = r.history.find(p => p.date === sortedDates[0]) || r.history[0];
    baselines[r.ticker] = firstPoint.close;
  });

  // 3. Build unified data array
  // { date: '2025-09-12', HAL: 0, BEL: 0, BDL: 0 }
  const data = sortedDates.map(date => {
    const point: any = { date };
    
    records.forEach(r => {
      const historicalPoint = r.history.find(p => p.date === date);
      if (historicalPoint && baselines[r.ticker]) {
        const baseline = baselines[r.ticker];
        const pctChange = ((historicalPoint.close - baseline) / baseline) * 100;
        point[r.ticker] = Number(pctChange.toFixed(2));
      } else {
        // If missing on this exact date, we might leave it undefined so the line skips, 
        // or we could carry over the last known value. Recharts handles undefined naturally.
        point[r.ticker] = undefined;
      }
    });
    
    return point;
  });

  return (
    <Card className="p-6 mb-8 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-bold tracking-tight">Price change over the last year</h3>
        
        <div className="flex items-center gap-4">
          {records.map((r, i) => (
            <div key={r.ticker} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="text-sm font-medium">{r.ticker}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
              tickFormatter={(val) => {
                const date = new Date(val);
                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
              }}
            />
            
            <YAxis 
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}%`}
              domain={['auto', 'auto']}
            />
            
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                color: 'var(--foreground)'
              }}
              // recharts types these loosely (ValueType/NameType), so narrow here
              // rather than fighting the generic signature.
              formatter={(value, name) => {
                const pct = Number(value);
                return [
                  <span key={String(name)} className="font-mono font-medium">
                    {pct > 0 ? "+" : ""}
                    {pct}%
                  </span>,
                  <span key={`${String(name)}_label`} className="font-semibold">
                    {String(name)}
                  </span>,
                ];
              }}
              labelFormatter={(label) =>
                new Date(String(label)).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              }
            />
            
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
            
            {records.map((r, i) => (
              <Line
                key={r.ticker}
                type="monotone"
                dataKey={r.ticker}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                connectNulls={true}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
