e"use client";

import type { RiskFactor, RiskLevel } from "@bit-n-build-2026/contracts";
import { AlertCircle, CheckCircle2, HelpCircle, ShieldAlert } from "lucide-react";

interface RiskBreakdownProps {
  risks: RiskFactor[];
}

const levelConfig: Record<RiskLevel, { color: string; bg: string; icon: any }> = {
  high: { color: "text-red-500", bg: "bg-red-500/10", icon: ShieldAlert },
  medium: { color: "text-amber-500", bg: "bg-amber-500/10", icon: AlertCircle },
  low: { color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle2 },
  unknown: { color: "text-slate-500", bg: "bg-slate-500/10", icon: HelpCircle },
};

export function RiskBreakdown({ risks }: RiskBreakdownProps) {
  if (!risks || risks.length === 0) return null;

  return (
    <div className="space-y-3">
      {risks.map((risk) => {
        const config = levelConfig[risk.level] || levelConfig.unknown;
        const Icon = config.icon;
        
        return (
          <div
            key={risk.key}
            className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-2 sm:w-1/4 shrink-0">
              <div className={`p-1.5 rounded-full ${config.bg} ${config.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{risk.label}</span>
                <span className={`text-xs font-semibold uppercase ${config.color}`}>
                  {risk.level}
                </span>
              </div>
            </div>
            
            <div className="flex-1 space-y-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {risk.reason}
              </p>
              {risk.sourceIds && risk.sourceIds.length > 0 && (
                <div className="text-[10px] text-muted-foreground font-mono">
                  [{risk.sourceIds.length} src]
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
