"use client";

import type { Concept } from "@bit-n-build-2026/contracts";
import { BookOpen } from "lucide-react";

interface ConceptsLearnedProps {
  concepts: Concept[];
}

export function ConceptsLearned({ concepts }: ConceptsLearnedProps) {
  if (!concepts || concepts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <BookOpen className="w-3.5 h-3.5 text-primary" /> Key Financial Concepts
      </div>
      <div className="flex flex-wrap gap-2">
        {concepts.map((concept) => (
          <div
            key={concept.key}
            className={`p-2.5 rounded-lg border text-xs space-y-1 max-w-xs ${
              concept.alreadyKnown
                ? "border-border/60 bg-muted/30 text-muted-foreground"
                : "border-primary/30 bg-primary/5 text-foreground"
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span>{concept.term}</span>
              {concept.alreadyKnown && (
                <span className="text-[10px] text-muted-foreground font-normal">
                  (Known)
                </span>
              )}
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {concept.explanation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
