"use client";

import { useState, useEffect } from "react";
import { Button } from "@bit-n-build-2026/ui/components/button";
import { Textarea } from "@bit-n-build-2026/ui/components/textarea";
import { MOCK_EXAMPLE_QUERIES } from "@bit-n-build-2026/contracts/mock";
import { ArrowRight, Sparkles } from "lucide-react";

interface ThesisInputProps {
  onSubmit: (query: string) => void;
  isLoading?: boolean;
  compact?: boolean;
  suggestedQuery?: string;
}

export function ThesisInput({ onSubmit, isLoading, compact, suggestedQuery }: ThesisInputProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (suggestedQuery) {
      setQuery(suggestedQuery);
    }
  }, [suggestedQuery]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isLoading) return;
    onSubmit(query.trim());
  };

  const handleChipClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
    onSubmit(exampleQuery);
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-sm">
        <p className="text-sm font-medium text-foreground line-clamp-1 italic">
          &ldquo;{query}&rdquo;
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuery("")}
          className="shrink-0 text-xs"
        >
          New Investigation
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative rounded-2xl border border-border bg-card p-4 shadow-lg focus-within:ring-2 focus-within:ring-ring transition-all">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Government increased defense spending, so I want to buy HAL..."
            className="w-full min-h-[110px] resize-none border-none bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Press Enter to analyze thesis
            </span>
            <Button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="rounded-xl px-5 gap-2 font-medium"
            >
              {isLoading ? "Analyzing..." : "Investigate"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </form>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Or try an example demo query:
        </p>
        <div className="flex flex-wrap gap-2">
          {MOCK_EXAMPLE_QUERIES.map((example, idx) => {
            const queryText = typeof example === "string" ? example : example.text;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(queryText)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors text-left"
              >
                &ldquo;{queryText}&rdquo;
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
