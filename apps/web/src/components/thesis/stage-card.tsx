"use client";

import { motion } from "motion/react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { Skeleton } from "@bit-n-build-2026/ui/components/skeleton";

interface StageCardProps {
  title: string;
  status: "pending" | "running" | "done" | "failed";
  badgeCount?: number;
  children?: React.ReactNode;
}

export function StageCard({ title, status, badgeCount, children }: StageCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col py-4 border-b border-border/50 last:border-b-0"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="shrink-0 flex items-center justify-center w-5 h-5">
          {status === "pending" && (
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
          )}
          {status === "running" && (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          )}
          {status === "done" && <Check className="w-5 h-5 text-green-600 dark:text-green-500" />}
          {status === "failed" && (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500" />
          )}
        </div>
        <h3
          className={`font-semibold text-sm tracking-tight uppercase ${
            status === "pending" ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {title}
        </h3>
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
            {badgeCount}
          </span>
        )}
      </div>

      <div className="pl-8">
        {status === "pending" && (
          <div className="space-y-2 opacity-50">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <Skeleton className="h-4 w-4/6 rounded" />
          </div>
        )}

        {status === "running" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
            <span className="animate-pulse">Analyzing data...</span>
          </div>
        )}

        {(status === "done" || status === "failed") && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {children}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
