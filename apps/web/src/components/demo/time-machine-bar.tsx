"use client";

import { useState, useEffect } from "react";
import { Button } from "@bit-n-build-2026/ui/components/button";
import { ENV } from "@/env";
import type { UserProfile, DemoStage } from "@bit-n-build-2026/contracts";
import { DEMO_STAGES, DEMO_STAGE_LABELS } from "@bit-n-build-2026/contracts";

export function TimeMachineBar() {
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
      }
    } catch (e) {
      console.warn("Could not seed demo", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
      <div className="flex gap-2">
        {DEMO_STAGES.map((stage) => (
          <Button
            key={stage}
            size="sm"
            variant={currentStage === stage ? "default" : "outline"}
            onClick={() => seedDemo(stage)}
            disabled={loading}
            className="text-xs font-semibold"
          >
            {DEMO_STAGE_LABELS[stage]}
          </Button>
        ))}
      </div>
      <div className="text-xs text-muted-foreground flex-1 md:text-right font-medium">
        {profile ? (
          <span className="flex flex-wrap items-center md:justify-end gap-x-2">
            <span className="text-foreground">Day {profile.dayIndex}</span>
            <span className="opacity-50">•</span>
            <span className="text-foreground">{profile.level}</span>
            <span className="opacity-50">•</span>
            <span>knows: {profile.knownConcepts.slice(0, 3).join(", ")}{profile.knownConcepts.length > 3 ? "..." : ""}</span>
            <span className="opacity-50">•</span>
            <span>{profile.holdings.length} positions</span>
            <span className="opacity-50">•</span>
            <span>{profile.pastTheses.length} past theses</span>
          </span>
        ) : (
          <span className="opacity-70">No profile data available (Mock mode)</span>
        )}
      </div>
    </div>
  );
}
