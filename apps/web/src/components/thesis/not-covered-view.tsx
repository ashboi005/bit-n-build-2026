"use client";

import type { NotCoveredData } from "@bit-n-build-2026/contracts";
import { Info } from "lucide-react";

interface NotCoveredViewProps {
  data: NotCoveredData;
}

export function NotCoveredView({ data }: NotCoveredViewProps) {
  const { name, ticker, covered } = data;

  const handleTickerClick = (t: string) => {
    const event = new CustomEvent("thwip-seed-demo", {
      detail: { suggestedPrompt: `I'm thinking about ${t} because...` },
    });
    window.dispatchEvent(event);
    
    // Scroll to top so the input is visible
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const bySector = covered.reduce((acc, c) => {
    if (!acc[c.sector]) acc[c.sector] = [];
    acc[c.sector].push(c);
    return acc;
  }, {} as Record<string, typeof covered>);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 py-6">
      <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
        <div className="flex items-start gap-4 text-card-foreground">
          <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">
              We don't have verified sources for {name || ticker || "that company"} yet.
            </h3>
            <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
              We only cover companies we've actually checked — {covered.length} of them — because every number we show has to come from somewhere.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Here's what we do cover:
        </h4>
        <div className="space-y-4">
          {Object.entries(bySector).map(([sector, companies]) => (
            <div key={sector} className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-4 items-baseline">
              <div className="text-sm text-muted-foreground font-medium">{sector}</div>
              <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                {companies.map((c, idx) => (
                  <div key={c.ticker} className="flex items-center">
                    <button
                      onClick={() => handleTickerClick(c.ticker)}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors hover:underline cursor-pointer"
                      title={c.name}
                    >
                      {c.ticker}
                    </button>
                    {idx < companies.length - 1 && (
                      <span className="text-muted-foreground/30 mx-2 select-none">&middot;</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
