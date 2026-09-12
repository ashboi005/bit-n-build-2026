"use client";

import type { Verdict } from "@bit-n-build-2026/contracts";
import { AlertCircle, CheckCircle2, HelpCircle, Lightbulb } from "lucide-react";

interface VerdictCardProps {
  verdict: Verdict | null;
}

export function VerdictCard({ verdict }: VerdictCardProps) {
  if (!verdict) return null;

  return (
    <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
      <h3 className="text-base font-semibold text-foreground">Where You Stand</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {verdict.holdsOn.length > 0 && (
          <div className="space-y-1.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Strongest Points
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {verdict.holdsOn.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {verdict.weakOn.length > 0 && (
          <div className="space-y-1.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" /> Weak Points / Vulnerabilities
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {verdict.weakOn.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {verdict.unverified.length > 0 && (
          <div className="space-y-1.5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
              <HelpCircle className="w-4 h-4" /> Unverified Claims
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {verdict.unverified.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {verdict.nextChecks.length > 0 && (
          <div className="space-y-1.5 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-1.5 font-semibold text-purple-600 dark:text-purple-400">
              <Lightbulb className="w-4 h-4" /> Recommended Next Checks
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {verdict.nextChecks.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-border text-[11px] text-muted-foreground italic flex items-center gap-2">
        <span>ⓘ</span>
        <p>{verdict.disclaimer}</p>
      </div>
    </div>
  );
}
