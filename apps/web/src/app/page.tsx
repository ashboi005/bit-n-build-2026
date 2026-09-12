"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useThesisRun } from "@/hooks/use-thesis-run";
import { ThesisInput } from "@/components/thesis/thesis-input";
import { Investigation } from "@/components/thesis/investigation";
import { Discovery } from "@/components/thesis/discovery";
import { TimeMachineBar } from "@/components/demo/time-machine-bar";
import Loader from "@/components/loader";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { 
    status, claim, stages, sources, metrics, concepts, verdict,
    discoveryState, mode,
    run 
  } = useThesisRun();
  const [suggestedQuery, setSuggestedQuery] = useState("");

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [isPending, session, router]);

  if (isPending || !session) {
    return <Loader />;
  }

  const isIdle = status === "idle";
  const isRunning = status === "running";

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-6">
        <TimeMachineBar onSeed={(prompt) => setSuggestedQuery(prompt)} />
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
          suggestedQuery={suggestedQuery}
        />

        {/* Live Investigation Assembly */}
        {!isIdle && mode === "thesis" && (
          <Investigation
            claim={claim}
            stages={stages}
            sources={sources}
            metrics={metrics}
            concepts={concepts}
            verdict={verdict}
          />
        )}

        {/* Discovery UI */}
        {!isIdle && mode === "discovery" && discoveryState && (
          <Discovery state={discoveryState} />
        )}
      </div>
    </main>
  );
}
