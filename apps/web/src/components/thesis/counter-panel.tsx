"use client";

import type { Finding } from "@bit-n-build-2026/contracts";
import { FindingRow } from "./finding-row";

interface CounterPanelProps {
  findings: Finding[];
}

export function CounterPanel({ findings }: CounterPanelProps) {
  if (!findings || findings.length === 0) return null;

  return (
    <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-amber-500 font-bold text-sm">⚠️ Counter-Evidence & Risks</span>
      </div>
      <div className="space-y-2">
        {findings.map((f) => (
          <FindingRow key={f.id} finding={f} />
        ))}
      </div>
    </div>
  );
}
