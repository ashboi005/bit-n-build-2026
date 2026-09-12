"use client";

import { useThesisRun } from "@/hooks/use-thesis-run";
import { ThesisInput } from "@/components/thesis/thesis-input";
import { Investigation } from "@/components/thesis/investigation";

export default function ThesisPage() {
  const { status, claim, stages, sources, metrics, concepts, verdict, run } =
    useThesisRun();

  const isIdle = status === "idle";
  const isRunning = status === "running";

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Title section */}
        {isIdle && (
          <div className="text-center space-y-2 py-8">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              Investigate Your Thesis
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
              Type your investment reasoning. We stress-test it against live data,
              verify claims with real sources, and highlight counter-arguments.
            </p>
          </div>
        )}

        {/* Thesis Input Component */}
        <ThesisInput
          onSubmit={(query) => run(query)}
          isLoading={isRunning}
          compact={!isIdle}
        />

        {/* Live Investigation Assembly */}
        {!isIdle && (
          <Investigation
            claim={claim}
            stages={stages}
            sources={sources}
            metrics={metrics}
            concepts={concepts}
            verdict={verdict}
          />
        )}
      </div>
    </main>
  );
}
