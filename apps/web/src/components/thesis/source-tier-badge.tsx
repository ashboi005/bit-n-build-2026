import {
  ShieldCheck,
  FileText,
  Newspaper,
  LineChart,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { SourceTier } from "@bit-n-build-2026/contracts";

interface SourceTierBadgeProps {
  tier: SourceTier;
  className?: string;
}

const TIER_MAP: Record<
  SourceTier,
  { icon: LucideIcon; label: string; className: string }
> = {
  official: {
    icon: ShieldCheck,
    label: "Official",
    className: "text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/20",
  },
  filing: {
    icon: FileText,
    label: "Filing",
    className: "text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/20",
  },
  press: {
    icon: Newspaper,
    label: "Press",
    className: "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  market_data: {
    icon: LineChart,
    label: "Market Data",
    className: "text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  social: {
    icon: MessageCircle,
    label: "Social",
    className: "text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/20",
  },
};

export function SourceTierBadge({ tier, className = "" }: SourceTierBadgeProps) {
  const config = TIER_MAP[tier];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
    </div>
  );
}
