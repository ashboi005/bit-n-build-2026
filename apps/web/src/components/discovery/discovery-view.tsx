"use client";

import { AlertCircle, Target, ArrowRight } from "lucide-react";
import type { DiscoveryState } from "@/hooks/use-thesis-run";
import { buttonVariants } from "@bit-n-build-2026/ui/components/button";
import Link from "next/link";
import { CandidateCard } from "./candidate-card";
import { SourceCard } from "../thesis/source-card";

export function DiscoveryView({ state }: { state: DiscoveryState }) {
  const { intent, candidates, summary, sources } = state;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500 py-6">
      
      <div className="text-center space-y-2 pb-2">
        <h3 className="text-2xl font-bold tracking-tight text-foreground">
          No single company named — looking across what we cover…
        </h3>
      </div>

      {intent && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-medium">
            <Target className="w-5 h-5" />
            <h2 className="text-xl tracking-tight">Interpreted Intent</h2>
          </div>
          <div className="p-6 bg-muted/50 rounded-xl space-y-4">
            <p className="text-lg font-medium">{intent.raw}</p>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {intent.goal && <span className="bg-background px-2 py-1 rounded shadow-sm border border-border">Goal: {intent.goal}</span>}
              {intent.horizon !== "unspecified" && (
                <span className="bg-background px-2 py-1 rounded shadow-sm border border-border">Horizon: {intent.horizon}</span>
              )}
              {intent.sectors.map((s: string) => (
                <span key={s} className="bg-background px-2 py-1 rounded shadow-sm border border-border">Sector: {s}</span>
              ))}
            </div>
          </div>
        </section>
      )}

      {candidates.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Discovered Candidates</h2>
          <div className="grid grid-cols-1 gap-6">
            {candidates.map((candidate) => (
              <CandidateCard key={candidate.ticker} candidate={candidate} />
            ))}
          </div>
        </section>
      )}

      {summary && (
        <section className="space-y-4 p-6 bg-muted/50 rounded-xl border border-border">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <h3 className="font-semibold text-lg">Discovery Complete</h3>
            <p className="text-sm text-muted-foreground">
              We reviewed {summary.universeSize} companies in our covered universe and found {summary.matched} that match your criteria.
            </p>
            <p className="text-xs text-muted-foreground italic mt-4">{summary.disclaimer}</p>
            <p className="font-medium mt-2">{summary.nextStep}</p>
          </div>
        </section>
      )}

      {Object.values(sources).length > 0 && (
        <section className="space-y-4 pt-8">
          <h2 className="text-lg font-semibold tracking-tight text-muted-foreground">Sources Referenced</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-80">
            {Object.values(sources).map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
