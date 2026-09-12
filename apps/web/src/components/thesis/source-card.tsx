import { Check, TriangleAlert, Minus, HelpCircle } from "lucide-react";
import type { SourceRef, Stance } from "@bit-n-build-2026/contracts";
import { SourceTierBadge } from "./source-tier-badge";

interface SourceCardProps {
  source: SourceRef;
  stance?: Stance;
}

export function SourceCard({ source, stance }: SourceCardProps) {
  const isLink = Boolean(source.url);

  const inner = (
    <div className="flex flex-col gap-2 p-3 rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-muted/50 transition-colors h-full text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SourceTierBadge tier={source.tier} className="shrink-0" />
          <span className="font-medium truncate" title={source.title}>
            {source.title}
          </span>
        </div>
        {stance && <StanceMarker stance={stance} />}
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/70">{source.publisher}</span>
        {source.publishedAt && (
          <>
            <span>&middot;</span>
            <time dateTime={source.publishedAt}>
              {new Date(source.publishedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </time>
          </>
        )}
      </div>

      <blockquote className="border-l-2 border-muted-foreground/30 pl-2.5 text-muted-foreground italic line-clamp-2 mt-0.5">
        "{source.snippet}"
      </blockquote>
    </div>
  );

  if (isLink) {
    return (
      <a
        href={source.url!}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg"
      >
        {inner}
      </a>
    );
  }

  return inner;
}

function StanceMarker({ stance }: { stance: Stance }) {
  switch (stance) {
    case "supports":
      return (
        <div className="shrink-0 flex items-center justify-center text-green-600 dark:text-green-500 bg-green-500/10 p-1 rounded-md" title="Supports">
          <Check className="h-4 w-4" />
        </div>
      );
    case "contradicts":
      return (
        <div className="shrink-0 flex items-center justify-center text-red-600 dark:text-red-500 bg-red-500/10 p-1 rounded-md" title="Contradicts">
          <TriangleAlert className="h-4 w-4" />
        </div>
      );
    case "neutral":
      return (
        <div className="shrink-0 flex items-center justify-center text-blue-600 dark:text-blue-500 bg-blue-500/10 p-1 rounded-md" title="Neutral">
          <Minus className="h-4 w-4" />
        </div>
      );
    case "unverified":
    default:
      return (
        <div className="shrink-0 flex items-center justify-center text-muted-foreground bg-muted p-1 rounded-md" title="Unverified">
          <HelpCircle className="h-4 w-4" />
        </div>
      );
  }
}
