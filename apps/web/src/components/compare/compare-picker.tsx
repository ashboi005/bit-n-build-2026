"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { StockSummary } from "@bit-n-build-2026/contracts";
import { Card } from "@bit-n-build-2026/ui/components/card";
import { Button } from "@bit-n-build-2026/ui/components/button";
import { Check, Info, Loader2 } from "lucide-react";

export function ComparePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedTickers = searchParams.get("tickers")?.split(",").filter(Boolean) || [];

  useEffect(() => {
    async function fetchStocks() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/stocks`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setStocks(data);
        }
      } catch (e) {
        console.error("Failed to load stocks for comparison", e);
      } finally {
        setLoading(false);
      }
    }
    fetchStocks();
  }, []);

  const toggleTicker = (ticker: string) => {
    let newTickers = [...selectedTickers];
    if (newTickers.includes(ticker)) {
      newTickers = newTickers.filter(t => t !== ticker);
    } else {
      if (newTickers.length >= 3) return; // max 3
      newTickers.push(ticker);
    }
    
    if (newTickers.length > 0) {
      router.replace(`/compare?tickers=${newTickers.join(",")}`);
    } else {
      router.replace(`/compare`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Group by sector
  const bySector = stocks.reduce((acc, stock) => {
    if (!acc[stock.sector]) acc[stock.sector] = [];
    acc[stock.sector].push(stock);
    return acc;
  }, {} as Record<string, StockSummary[]>);

  // Figure out which sectors are active (i.e. have a selected stock)
  const selectedSectors = new Set(
    selectedTickers.map(t => stocks.find(s => s.ticker === t)?.sector).filter(Boolean)
  );

  const isMaxReached = selectedTickers.length >= 3;

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Pick companies to compare</h2>
          <p className="text-sm text-muted-foreground mt-1">Select 2 or 3 companies. Same-sector comparisons work best.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium bg-muted/30 px-3 py-1.5 rounded-md flex items-center gap-2">
            <span>{selectedTickers.length} / 3 selected</span>
          </div>
          {selectedTickers.length >= 2 && (
            <Button 
              onClick={() => {
                document.getElementById('compare-table-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="font-bold cursor-pointer"
            >
              Compare {selectedTickers.length} companies
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Object.entries(bySector)
          // Sort active sectors first
          .sort(([sectorA], [sectorB]) => {
            const aActive = selectedSectors.has(sectorA);
            const bActive = selectedSectors.has(sectorB);
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            return sectorA.localeCompare(sectorB);
          })
          .map(([sector, sectorStocks]) => {
            const isSectorActive = selectedSectors.has(sector);
            
            return (
              <div 
                key={sector} 
                className={`flex flex-col gap-2 p-4 rounded-xl border transition-colors ${
                  isSectorActive ? "bg-primary/5 border-primary/20 shadow-sm ring-1 ring-primary/10" : "bg-card border-border/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`font-semibold text-sm ${isSectorActive ? "text-primary" : "text-muted-foreground"}`}>
                    {sector}
                  </h3>
                  {isSectorActive && <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Active</span>}
                </div>
                
                <div className="flex flex-col gap-2">
                  {sectorStocks.map(stock => {
                    const isSelected = selectedTickers.includes(stock.ticker);
                    const isDisabled = !isSelected && isMaxReached;
                    
                    return (
                      <button
                        key={stock.ticker}
                        disabled={isDisabled}
                        onClick={() => toggleTicker(stock.ticker)}
                        className={`
                          text-left px-3 py-2 rounded-lg border text-sm transition-all flex items-center justify-between
                          ${isSelected 
                            ? "bg-primary text-primary-foreground border-primary font-medium shadow-md scale-[1.02]" 
                            : isDisabled 
                              ? "opacity-50 cursor-not-allowed bg-muted/30 border-transparent" 
                              : "bg-background hover:bg-muted/50 border-border hover:border-primary/30 cursor-pointer"
                          }
                        `}
                      >
                        <div className="flex flex-col truncate pr-2">
                          <span className={isSelected ? "font-bold" : "font-semibold"}>{stock.ticker}</span>
                          <span className={`text-[10px] truncate ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                            {stock.name}
                          </span>
                        </div>
                        {isSelected && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
}
