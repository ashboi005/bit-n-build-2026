"use client";

import type { Finding, SourceRef } from "@bit-n-build-2026/contracts";

interface FindingRowProps {
  finding: Finding;
  sources?: Record<string, SourceRef>;
}

export function FindingRow({ finding, sources }: FindingRowProps) {
  const sourceCount = finding.sourceIds.length;

  return (
    <div className="flex items-start justify-between gap-3 text-sm py-1.5 border-b border-border/40 last:border-0">
      <p className="text-foreground/90 leading-relaxed">{finding.text}</p>
      {sourceCount > 0 && (
        <span
          className="shrink-0 text-xs px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/60 font-mono"
          title={`Supported by ${sourceCount} source(s)`}
        >
          [{sourceCount} source{sourceCount > 1 ? "s" : ""}]
        </span>
      )}
    </div>
  );
}
