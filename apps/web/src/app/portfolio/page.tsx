"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ENV } from "@/env";
import type { Portfolio } from "@bit-n-build-2026/contracts";
import { Card } from "@bit-n-build-2026/ui/components/card";
import Loader from "@/components/loader";

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/portfolio`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setPortfolio(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error(err);
        setError(true);
      }
    }
    fetchPortfolio();

    const handleDemoSeeded = () => {
      fetchPortfolio();
    };
    window.addEventListener("thwip-seed-demo", handleDemoSeeded);
    return () => window.removeEventListener("thwip-seed-demo", handleDemoSeeded);
  }, []);

  if (error) {
    return <div className="p-8 text-center text-destructive">Failed to load portfolio.</div>;
  }

  if (!portfolio) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader className="w-8 h-8" />
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Portfolio</h1>
        <p className="text-muted-foreground">
          Your current holdings, watched assets, and past decisions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 bg-card border-border shadow-sm flex flex-col justify-center">
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Total Invested
          </span>
          <span className="text-4xl font-bold font-mono">
            ₹{portfolio.totalInvested.toLocaleString()}
          </span>
        </Card>
        <Card className="p-6 bg-card border-border shadow-sm flex flex-col justify-center">
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Current Value
          </span>
          <span className="text-4xl font-bold font-mono">
            {portfolio.totalCurrent !== null
              ? `₹${portfolio.totalCurrent.toLocaleString()}`
              : "—"}
          </span>
        </Card>
      </div>

      {portfolio.positions.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight border-b pb-2">Holdings</h2>
          <div className="grid gap-4">
            {portfolio.positions.map((pos) => (
              <Link key={pos.ticker} href={`/stocks/${pos.ticker}`} className="block">
                <Card className="p-4 bg-card border-border hover:bg-muted/30 transition-colors shadow-sm overflow-hidden relative">
                  {/* Concentration background bar */}
                  <div 
                    className="absolute inset-y-0 left-0 bg-primary/5 pointer-events-none transition-all"
                    style={{ width: `${pos.weight * 100}%` }}
                  />
                  
                  <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex flex-col">
                        <span className="font-bold text-lg">{pos.ticker}</span>
                        <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={pos.companyName}>
                          {pos.companyName}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Quantity</span>
                        <span className="font-medium">{pos.quantity}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Avg Price</span>
                        <span className="font-medium">₹{pos.avgPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Current</span>
                        <span className="font-medium">
                          {pos.currentValue !== null ? `₹${pos.currentValue.toLocaleString()}` : "—"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Weight</span>
                        <span className="font-bold text-primary">{(pos.weight * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center text-muted-foreground bg-muted/20 border-dashed">
          You don't hold any positions yet.
        </Card>
      )}

      {portfolio.skipped.length > 0 && (
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-semibold tracking-tight border-b pb-2 text-amber-600 dark:text-amber-500">
            Skipped
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Companies you investigated but decided against.
          </p>
          <div className="grid gap-4">
            {portfolio.skipped.map((skip) => (
              <Card key={skip.ticker} className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50">
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold">{skip.ticker}</span>
                    <span className="text-sm text-muted-foreground">{skip.companyName}</span>
                  </div>
                  {skip.reasoning && (
                    <blockquote className="border-l-2 border-amber-400 dark:border-amber-600 pl-3 text-sm italic text-amber-900 dark:text-amber-200">
                      "{skip.reasoning}"
                    </blockquote>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {portfolio.watching.length > 0 && (
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-semibold tracking-tight border-b pb-2 text-blue-600 dark:text-blue-500">
            Watching
          </h2>
          <div className="flex flex-wrap gap-2">
            {portfolio.watching.map((watch) => (
              <Link key={watch.ticker} href={`/stocks/${watch.ticker}`}>
                <Card className="px-3 py-1.5 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                  <span className="font-medium text-blue-900 dark:text-blue-200">{watch.ticker}</span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
