"use client";

import { useState, useEffect } from "react";
import { Button } from "@bit-n-build-2026/ui/components/button";
import { ENV } from "@/env";
import type { UserProfile, DemoStage } from "@bit-n-build-2026/contracts";
import { DEMO_STAGES, DEMO_STAGE_LABELS } from "@bit-n-build-2026/contracts";
import { motion } from "motion/react";

import { Loader2 } from "lucide-react";

interface TimeMachineBarProps {
  onSeed?: (prompt: string) => void;
  className?: string;
  compact?: boolean;
}

export function TimeMachineBar({ onSeed, className = "", compact = false }: TimeMachineBarProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<DemoStage>("day0");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/profile`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {
      console.warn("Could not fetch profile", e);
    }
  };

  const seedDemo = async (stage: DemoStage) => {
    setLoading(true);
    setCurrentStage(stage);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/demo/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stage }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        if (data.suggestedPrompt && onSeed) {
          onSeed(data.suggestedPrompt);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("thwip-seed-demo", {
              detail: {
                suggestedPrompt: data.suggestedPrompt,
                stage: data.stage,
                profile: data.profile,
              },
            })
          );
        }
      }
    } catch (e) {
      console.warn("Could not seed demo", e);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {DEMO_STAGES.map((stage) => (
          <Button
            key={stage}
            size="sm"
            variant={currentStage === stage ? "default" : "outline"}
            onClick={() => seedDemo(stage)}
            disabled={loading}
            className="h-8 px-3 text-xs font-semibold cursor-pointer"
          >
            {loading && currentStage === stage ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
            ) : null}
            {DEMO_STAGE_LABELS[stage]}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className={`w-full flex flex-col gap-2.5 ${className}`}>
      <div className="p-4 md:p-5 rounded-xl border border-primary/30 bg-card/90 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs uppercase tracking-wider font-mono font-bold text-muted-foreground mr-1">
            Stage:
          </span>
          {DEMO_STAGES.map((stage) => (
            <Button
              key={stage}
              size="default"
              variant={currentStage === stage ? "default" : "outline"}
              onClick={() => seedDemo(stage)}
              disabled={loading}
              className="h-9 px-4 text-sm font-semibold transition-all cursor-pointer"
            >
              {loading && currentStage === stage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : null}
              {DEMO_STAGE_LABELS[stage]}
            </Button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground flex-1 md:text-right font-medium overflow-hidden">
          {profile ? (
            <motion.span 
              key={profile.dayIndex}
              initial={{ backgroundColor: "rgba(230, 36, 41, 0.4)", color: "#fff" }} // THWIP crimson pulse
              animate={{ backgroundColor: "rgba(0,0,0,0)", color: "var(--muted-foreground)" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="inline-flex flex-wrap items-center md:justify-end gap-x-2 px-2 py-1 rounded bg-muted/40"
            >
              <span className="text-foreground font-bold font-mono">Day {profile.dayIndex}</span>
              <span className="opacity-50">•</span>
              <span className="text-foreground capitalize font-medium">{profile.level}</span>
              <span className="opacity-50">•</span>
              <span>knows: {profile.knownConcepts.slice(0, 3).join(", ")}{profile.knownConcepts.length > 3 ? "..." : ""}</span>
              <span className="opacity-50">•</span>
              <span className="font-semibold text-foreground">{profile.holdings.length} positions</span>
              <span className="opacity-50">•</span>
              <span>{profile.pastTheses.length} past theses</span>
            </motion.span>
          ) : (
            <span className="opacity-70">No profile data available (Mock mode)</span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground text-center font-mono">
        Seeds this user&apos;s history across the app. The investigation itself still runs live.
      </p>
    </div>
  );
}
