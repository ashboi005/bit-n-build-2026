"use client";

import { useState, useEffect } from "react";
import { Button } from "@bit-n-build-2026/ui/components/button";
import { ENV } from "@/env";
import type { UserProfile, DemoStage } from "@bit-n-build-2026/contracts";
import { DEMO_STAGES, DEMO_STAGE_LABELS } from "@bit-n-build-2026/contracts";
import { motion } from "motion/react";

interface TimeMachineBarProps {
  onSeed?: (prompt: string) => void;
}

export function TimeMachineBar({ onSeed }: TimeMachineBarProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<DemoStage>("day0");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${ENV.NEXT_PUBLIC_SERVER_URL}/api/profile`, {
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
      const res = await fetch(`${ENV.NEXT_PUBLIC_SERVER_URL}/api/demo/seed`, {
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
      }
    } catch (e) {
      console.warn("Could not seed demo", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mb-6 flex flex-col gap-2">
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex gap-2">
          {DEMO_STAGES.map((stage) => (
            <Button
              key={stage}
              size="sm"
              variant={currentStage === stage ? "default" : "outline"}
              onClick={() => seedDemo(stage)}
              disabled={loading}
              className="text-xs font-semibold transition-all"
            >
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
              className="inline-flex flex-wrap items-center md:justify-end gap-x-2 px-1 rounded"
            >
              <span className="text-foreground">Day {profile.dayIndex}</span>
              <span className="opacity-50">•</span>
              <span className="text-foreground">{profile.level}</span>
              <span className="opacity-50">•</span>
              <span>knows: {profile.knownConcepts.slice(0, 3).join(", ")}{profile.knownConcepts.length > 3 ? "..." : ""}</span>
              <span className="opacity-50">•</span>
              <span>{profile.holdings.length} positions</span>
              <span className="opacity-50">•</span>
              <span>{profile.pastTheses.length} past theses</span>
            </motion.span>
          ) : (
            <span className="opacity-70">No profile data available (Mock mode)</span>
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Seeds this user's history. The investigation itself still runs live.
      </p>
    </div>
  );
}
