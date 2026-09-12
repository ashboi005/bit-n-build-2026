"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { StockRecord, SourceRef } from "@bit-n-build-2026/contracts";
import { ENV } from "@/env";
import { StockProfile } from "@/components/stocks/stock-profile";
import { Skeleton } from "@bit-n-build-2026/ui/components/skeleton";

export default function StockPage() {
  const params = useParams();
  const ticker = typeof params?.ticker === "string" ? params.ticker : null;

  const [stock, setStock] = useState<StockRecord | null>(null);
  const [sources, setSources] = useState<SourceRef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/stocks/${ticker}`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Failed to load profile: ${res.statusText}`);
        }

        const data = await res.json();
        // Assume API returns { stock: StockRecord, recentSources: SourceRef[] } 
        // or just a StockRecord where we extract what we can. 
        // We'll flexibly handle both.
        if (data.stock && data.recentSources) {
          setStock(data.stock);
          setSources(data.recentSources);
        } else {
          setStock(data);
          // If the backend doesn't populate recentSources yet, default to empty
          setSources(data.recentSources || []);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load stock profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [ticker]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-12 animate-pulse">
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="p-4 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="p-4 rounded-lg bg-muted text-muted-foreground border">
          <p>We don't have verified sources for that company yet.</p>
        </div>
      </div>
    );
  }

  return <StockProfile stock={stock} recentSources={sources} />;
}
