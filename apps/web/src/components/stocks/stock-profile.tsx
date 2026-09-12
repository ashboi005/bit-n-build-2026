"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StockRecord, SourceRef } from "@bit-n-build-2026/contracts";
import { MetricGrid } from "@/components/thesis/metric-grid";
import { RiskBreakdown } from "./risk-breakdown";
import { SourceCard } from "@/components/thesis/source-card";
import { buttonVariants } from "@bit-n-build-2026/ui/components/button";

interface StockProfileProps {
  stock: StockRecord;
  recentSources: SourceRef[];
}

export function StockProfile({ stock, recentSources }: StockProfileProps) {
  return (
    <div className="max-w-3xl mx-auto py-8 space-y-12">
      <header className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{stock.name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground mt-1 text-sm">
            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
              {stock.ticker}
            </span>
            <span>&middot;</span>
            <span>{stock.sector}</span>
          </div>
        </div>
        
        <div className="prose prose-sm dark:prose-invert">
          <p className="text-base text-foreground leading-relaxed">
            {stock.business}
          </p>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">The Numbers</h2>
        <MetricGrid metrics={stock.metrics} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Risk Breakdown</h2>
        <RiskBreakdown risks={stock.risk} />
      </section>

      {recentSources.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Recent Sources</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentSources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        </section>
      )}

      <section className="pt-8 border-t border-border">
        <div className="bg-muted/50 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <h3 className="font-semibold text-lg">Thinking about investing in this?</h3>
            <p className="text-sm text-muted-foreground">Tell us why, and we'll investigate your reasoning.</p>
          </div>
          <Link href={`/thesis?ticker=${stock.ticker}`} className={buttonVariants({ size: "lg", className: "shrink-0" })}>
            Tell us why <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>
    </div>
  );
}
