"use client";

import type { StageId, SourceRef, Finding, Metric, Concept, Verdict, ParsedClaim } from "@bit-n-build-2026/contracts";
import { STAGE_LABELS } from "@bit-n-build-2026/contracts";
import { StageCard } from "./stage-card";
import { ClaimChips } from "./claim-chips";
import { SourceCard } from "./source-card";
import { FindingRow } from "./finding-row";
import { MetricGrid } from "./metric-grid";
import { CounterPanel } from "./counter-panel";
import { ConceptsLearned } from "./concepts-learned";
import { VerdictCard } from "./verdict-card";
import { DecisionCapture } from "./decision-capture";

interface InvestigationProps {
  claim: ParsedClaim | null;
  stages: Record<StageId, { status: "pending" | "running" | "done" | "failed"; label?: string; findings?: Finding[] }>;
  sources: Record<string, SourceRef & { stance?: "supports" | "contradicts" | "neutral" | "unverified" }>;
  metrics: Metric[];
  concepts: Concept[];
  verdict: Verdict | null;
}

export function Investigation({
  claim,
  stages,
  sources,
  metrics,
  concepts,
  verdict,
}: InvestigationProps) {
  const sourceList = Object.values(sources);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Stage: Parse Claim */}
      {stages.parse && (
        <StageCard title={STAGE_LABELS.parse} status={stages.parse.status}>
          <ClaimChips claim={claim} />
        </StageCard>
      )}

      {/* Stage: Gather Sources */}
      {stages.gather && (
        <StageCard
          title={STAGE_LABELS.gather}
          status={stages.gather.status}
          badgeCount={sourceList.length}
        >
          {sourceList.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {sourceList.map((src) => (
                <SourceCard key={src.id} source={src} stance={src.stance} />
              ))}
            </div>
          )}
        </StageCard>
      )}

      {/* Stage: Verify Trigger */}
      {stages.verify_trigger && (
        <StageCard title={STAGE_LABELS.verify_trigger} status={stages.verify_trigger.status}>
          {stages.verify_trigger.findings?.map((f) => (
            <FindingRow key={f.id} finding={f} sources={sources} />
          ))}
        </StageCard>
      )}

      {/* Stage: Link Exposure */}
      {stages.link_exposure && (
        <StageCard title={STAGE_LABELS.link_exposure} status={stages.link_exposure.status}>
          {stages.link_exposure.findings?.map((f) => (
            <FindingRow key={f.id} finding={f} sources={sources} />
          ))}
        </StageCard>
      )}

      {/* Stage: Fundamentals */}
      {stages.fundamentals && (
        <StageCard title={STAGE_LABELS.fundamentals} status={stages.fundamentals.status}>
          <MetricGrid metrics={metrics} />
        </StageCard>
      )}

      {/* Stage: Challenge / Counter Panel */}
      {stages.challenge && (
        <StageCard title={STAGE_LABELS.challenge} status={stages.challenge.status}>
          {stages.challenge.findings && stages.challenge.findings.length > 0 ? (
            <CounterPanel findings={stages.challenge.findings} />
          ) : null}
        </StageCard>
      )}

      {/* Stage: Concepts Learned */}
      {stages.learn && (
        <StageCard title={STAGE_LABELS.learn} status={stages.learn.status}>
          <ConceptsLearned concepts={concepts} />
        </StageCard>
      )}

      {/* Stage: Verdict */}
      {stages.verdict && stages.verdict.status !== "pending" && (
        <>
          <VerdictCard verdict={verdict} />
          {stages.verdict.status === "done" && claim?.asset && claim?.raw && (
            <DecisionCapture 
              ticker={claim.asset.ticker}
              companyName={claim.asset.name}
              thesis={claim.raw}
            />
          )}
        </>
      )}
    </div>
  );
}
