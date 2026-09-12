"use client";

import { useState } from "react";
import { Button } from "@bit-n-build-2026/ui/components/button";
import { Input } from "@bit-n-build-2026/ui/components/input";
import { Textarea } from "@bit-n-build-2026/ui/components/textarea";
import { Card } from "@bit-n-build-2026/ui/components/card";
import { ENV } from "@/env";
import type { DecisionAction } from "@bit-n-build-2026/contracts";

interface DecisionCaptureProps {
  ticker: string;
  companyName: string;
  thesis: string;
}

export function DecisionCapture({ ticker, companyName, thesis }: DecisionCaptureProps) {
  const [action, setAction] = useState<DecisionAction | null>(null);
  const [quantity, setQuantity] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!action) return;
    setSubmitting(true);
    
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ticker,
          action,
          quantity: action === "bought" || action === "sold" ? Number(quantity) || null : null,
          pricePerShare: action === "bought" || action === "sold" ? Number(pricePerShare) || null : null,
          thesis,
          reasoning: reasoning.trim() || null,
        }),
      });
      setDone(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Card className="p-6 mt-8 border-border bg-card shadow-sm text-center">
        <p className="text-foreground font-medium">Your decision has been recorded.</p>
        <p className="text-sm text-muted-foreground mt-1">This will update your portfolio and context.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 mt-8 border-border bg-card shadow-sm">
      <h3 className="text-lg font-semibold text-foreground mb-4">What did you decide?</h3>
      
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Button 
          variant={action === "bought" ? "default" : "outline"} 
          onClick={() => setAction("bought")}
          className={`flex-1 transition-all ${action === "bought" ? "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent" : ""}`}
        >
          I bought it
        </Button>
        <Button 
          variant={action === "skipped" ? "default" : "outline"} 
          onClick={() => setAction("skipped")}
          className={`flex-1 transition-all ${action === "skipped" ? "bg-amber-500 hover:bg-amber-600 text-white border-transparent" : "border-primary/40 hover:bg-primary/5"}`}
        >
          I'm skipping this
        </Button>
        <Button 
          variant={action === "watching" ? "default" : "outline"} 
          onClick={() => setAction("watching")}
          className={`flex-1 transition-all ${action === "watching" ? "bg-blue-500 hover:bg-blue-600 text-white border-transparent" : ""}`}
        >
          I'm watching it
        </Button>
        <Button 
          variant={action === "sold" ? "default" : "outline"} 
          onClick={() => setAction("sold")}
          className={`flex-1 transition-all ${action === "sold" ? "bg-red-600 hover:bg-red-700 text-white border-transparent" : ""}`}
        >
          I sold it
        </Button>
      </div>

      {action && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {(action === "bought" || action === "sold") && (
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Quantity</label>
                <Input 
                  type="number" 
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)} 
                  placeholder="e.g. 15" 
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Price per share (₹)</label>
                <Input 
                  type="number" 
                  value={pricePerShare} 
                  onChange={(e) => setPricePerShare(e.target.value)} 
                  placeholder="e.g. 420" 
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground flex justify-between">
              Why? <span className="opacity-60">(optional)</span>
            </label>
            <Textarea 
              value={reasoning} 
              onChange={(e) => setReasoning(e.target.value)} 
              placeholder={action === "skipped" ? "e.g. The valuation seems too high right now..." : "e.g. I checked the order book and it looked strong..."}
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : "Save Decision"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
