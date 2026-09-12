"use client";

import { ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@bit-n-build-2026/ui/components/button";
import type { DiscoveryCandidate } from "@bit-n-build-2026/contracts";

interface CandidateCardProps {
  candidate: DiscoveryCandidate;
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  const handleInvestigateClick = (ticker: string) => {
    const event = new CustomEvent("thwip-seed-demo", {
      detail: { suggestedPrompt: `I want to look into ${ticker} because...` },
    });
    window.dispatchEvent(event);
    
    // Scroll to top so the input is visible
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden shadow-sm">
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
          <button
            onClick={() => handleInvestigateClick(candidate.ticker)}
            className={buttonVariants({ variant: "outline", size: "sm" }) + " cursor-pointer"}
          >
            Investigate <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{candidate.business}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Why it matches */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-primary flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Why it matches
            </h4>
            <ul className="space-y-3">
              {candidate.matchedOn.map((match, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium block text-foreground">{match.label}</span>
                  <span className="text-muted-foreground leading-relaxed">{match.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What to watch out for */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-primary flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> What to watch out for
            </h4>
            <ul className="space-y-3">
              {candidate.watchOut.map((watch, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium block text-foreground">{watch.label}</span>
                  <span className="text-muted-foreground leading-relaxed">{watch.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
