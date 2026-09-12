"use client";

import { AlertCircle, Target, ArrowRight } from "lucide-react";
import type { DiscoveryState } from "@/hooks/use-thesis-run";
import { buttonVariants } from "@bit-n-build-2026/ui/components/button";
import Link from "next/link";
import { SourceCard } from "./source-card";

export function Discovery({ state }: { state: DiscoveryState }) {
  const { intent, candidates, summary, sources } = state;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-12">
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
              <div key={candidate.ticker} className="border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 bg-card space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold">{candidate.name}</h3>
                      <div className="flex items-center gap-2 text-muted-foreground mt-1 text-sm">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{candidate.ticker}</span>
                        <span>&middot;</span>
                        <span>{candidate.sector}</span>
                      </div>
                    </div>
                    <Link href={`/?ticker=${candidate.ticker}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Investigate <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </div>

                  <p className="text-sm text-muted-foreground">{candidate.business}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-primary">Why it matches</h4>
                      <ul className="space-y-2">
                        {candidate.matchedOn.map((match: any, i: number) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium block">{match.label}</span>
                            <span className="text-muted-foreground">{match.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" /> What to watch out for
                      </h4>
                      <ul className="space-y-2">
                        {candidate.watchOut.map((watch: any, i: number) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium block">{watch.label}</span>
                            <span className="text-muted-foreground">{watch.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
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
