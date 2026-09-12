"use client";

import { useEffect, useState } from "react";
import type { ChangeReport, ChangeItem, ChangeSignal } from "@bit-n-build-2026/contracts";
import { Card } from "@bit-n-build-2026/ui/components/card";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, CircleDashed, Loader2 } from "lucide-react";

export function ChangesSection() {
  const [report, setReport] = useState<ChangeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchChanges() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/changes`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setReport(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    
    fetchChanges();

    const handleDemoSeeded = () => {
      setLoading(true);
      fetchChanges();
    };
    window.addEventListener("thwip-seed-demo", handleDemoSeeded);
    return () => window.removeEventListener("thwip-seed-demo", handleDemoSeeded);
  }, []);

  if (error) {
    return null; // Or a subtle error state
  }

  if (loading) {
    return (
      <div className="py-8 flex justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-6 mb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">What Changed</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            {report.disclaimer}
          </p>
        </div>
        <div className="text-sm font-medium flex gap-4 text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-md">
          <span>Reviewed: {report.summary.reviewed}</span>
          {report.summary.needsAttention > 0 && (
            <span className="text-destructive font-bold flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Needs attention: {report.summary.needsAttention}
            </span>
          )}
        </div>
      </div>

      {report.items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground bg-muted/20 border-dashed">
          Once you record what you decided, this is where we'll tell you whether your reasoning held up.
        </Card>
      ) : (
        <div className="grid gap-6">
          {report.items.map((item) => (
            <ChangeItemCard key={item.decision.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChangeItemCard({ item }: { item: ChangeItem }) {
  const getStatusDisplay = (status: ChangeItem["thesisStatus"]) => {
    switch (status) {
      case "holding": return { label: "Still holds", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" };
      case "weakening": return { label: "Partly holding", icon: AlertTriangle, color: "text-amber-600 dark:text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20" };
      case "broken": return { label: "Not held up", icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" };
      case "too_early": return { label: "Too early to tell", icon: CircleDashed, color: "text-blue-600 dark:text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20" };
      case "unclear":
      default: return { label: "Can't tell yet", icon: Info, color: "text-muted-foreground", bg: "bg-muted/50" };
    }
  };

  const statusStyle = getStatusDisplay(item.thesisStatus);
  const StatusIcon = statusStyle.icon;

  const getSignalColor = (severity: ChangeSignal["severity"]) => {
    switch (severity) {
      case "warning": return "text-destructive";
      case "attention": return "text-amber-600 dark:text-amber-500";
      case "info":
      default: return "text-blue-600 dark:text-blue-500";
    }
  };

  const getSignalIcon = (severity: ChangeSignal["severity"]) => {
    switch (severity) {
      case "warning": return <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />;
      case "attention": return <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-500" />;
      case "info":
      default: return <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-500" />;
    }
  };

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm">
      {/* Header */}
      <div className="p-5 border-b bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-lg">{item.ticker}</span>
          <span className="text-muted-foreground">{item.companyName}</span>
        </div>
        <div className="text-sm text-muted-foreground font-medium bg-background px-2.5 py-1 rounded shadow-sm border">
          {item.decision.action === "buy" ? "Bought" : item.decision.action === "sell" ? "Sold" : "Skipped"} {item.decision.daysAgo} days ago
        </div>
      </div>

      {/* Thesis */}
      <div className="p-5">
        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex justify-between items-center">
          <span>You said:</span>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold ${statusStyle.bg} ${statusStyle.color}`}>
            <StatusIcon className="h-4 w-4" />
            {statusStyle.label}
          </div>
        </div>
        {item.decision.thesis ? (
          <blockquote className="text-lg italic font-medium text-foreground/90 border-l-4 border-primary/20 pl-4 py-1">
            "{item.decision.thesis}"
          </blockquote>
        ) : (
          <div className="text-muted-foreground italic pl-4">No specific reasoning recorded.</div>
        )}
      </div>

      {/* Numbers */}
      <div className="px-5 py-3 border-y bg-muted/5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs uppercase font-semibold">Price Move</span>
          <div className="font-mono mt-1">
            {item.price ? (
              <span className="flex items-center gap-2">
                <span>₹{item.price.then.toLocaleString()}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">₹{item.price.now.toLocaleString()}</span>
                <span className={`ml-2 font-bold ${item.price.changePct < 0 ? 'text-destructive' : item.price.changePct > 0 ? 'text-emerald-600' : ''}`}>
                  {item.price.changePct > 0 ? '+' : ''}{(item.price.changePct * 100).toFixed(1)}%
                </span>
              </span>
            ) : "—"}
          </div>
        </div>
        {item.position && (
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs uppercase font-semibold">Position</span>
            <div className="font-mono mt-1 text-muted-foreground flex gap-3">
              <span>{item.position.quantity} shares</span>
              <span>₹{item.position.investedValue.toLocaleString()} invested</span>
              <span>now ₹{item.position.currentValue.toLocaleString()}</span>
              <span className={item.position.profitLoss < 0 ? 'text-destructive font-medium' : item.position.profitLoss > 0 ? 'text-emerald-600 font-medium' : ''}>
                {item.position.profitLoss > 0 ? '+' : ''}₹{item.position.profitLoss.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Signals */}
      {item.signals.length > 0 && (
        <div className="p-5 border-b border-dashed">
          <div className="space-y-3">
            {item.signals.map((signal, idx) => (
              <div key={idx} className="flex items-start gap-2">
                {getSignalIcon(signal.severity)}
                <div className="text-sm leading-snug">
                  <span className={`font-semibold ${getSignalColor(signal.severity)}`}>{signal.label}</span>
                  <span className="text-muted-foreground mx-1">—</span>
                  <span className="text-foreground">{signal.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Checks */}
      {item.nextChecks.length > 0 && (
        <div className="p-5 bg-muted/10">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            What to check next
          </div>
          <ul className="space-y-1.5 pl-6 list-disc text-sm text-muted-foreground">
            {item.nextChecks.map((check, idx) => (
              <li key={idx} className="leading-snug">{check}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
