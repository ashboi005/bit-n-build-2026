"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useThesisRun } from "@/hooks/use-thesis-run";
import { ThesisInput } from "@/components/thesis/thesis-input";
import { Investigation } from "@/components/thesis/investigation";
import { DiscoveryView } from "@/components/discovery/discovery-view";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import Loader from "@/components/loader";
import { LandingPage } from "@/components/landing-page";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();
  const { 
    status, claim, stages, sources, metrics, concepts, verdict, notCovered,
    discoveryState, mode,
    run 
  } = useThesisRun();
  const [suggestedQuery, setSuggestedQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ suggestedPrompt?: string }>;
      if (customEvent.detail?.suggestedPrompt) {
        setSuggestedQuery(customEvent.detail.suggestedPrompt);
      }
    };
    window.addEventListener("thwip-seed-demo", handler);
    return () => window.removeEventListener("thwip-seed-demo", handler);
  }, []);

  if (isPending) {
    return <Loader />;
  }

  if (!session) {
    return <LandingPage />;
  }

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
            notCovered={notCovered}
          />
        )}

        {/* Discovery UI */}
        {!isIdle && mode === "discovery" && discoveryState && (
          <DiscoveryView state={discoveryState} />
        )}
      </div>
      <OnboardingFlow />
    </main>
  );
}
