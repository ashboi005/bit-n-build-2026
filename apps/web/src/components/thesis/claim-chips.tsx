"use client";

import type { ParsedClaim } from "@bit-n-build-2026/contracts";

interface ClaimChipsProps {
  claim: ParsedClaim | null;
}

export function ClaimChips({ claim }: ClaimChipsProps) {
  if (!claim) return null;

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {claim.trigger && (
        <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 font-medium">
          Trigger: {claim.trigger.text} ({claim.trigger.kind})
        </span>
      )}
      {claim.asset && (
        <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border font-medium">
          Asset: {claim.asset.name} ({claim.asset.ticker})
        </span>
      )}
      {claim.mechanism && (
        <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border">
          Mechanism: {claim.mechanism}
        </span>
      )}
      {claim.horizon && claim.horizon !== "unspecified" && (
        <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border">
          Horizon: {claim.horizon}
        </span>
      )}
    </div>
  );
}
