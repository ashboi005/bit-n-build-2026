"use client";

import { useState, useEffect } from "react";
import { Button } from "@bit-n-build-2026/ui/components/button";
import { Input } from "@bit-n-build-2026/ui/components/input";
import { Textarea } from "@bit-n-build-2026/ui/components/textarea";
import { ENV } from "@/env";
import {
  AGE_BANDS,
  EXPERIENCES,
  PRIMARY_GOALS,
  HORIZONS,
  RISK_COMFORTS,
  ONBOARDING_LABELS,
  type OnboardingAnswers,
  type OnboardingState,
} from "@bit-n-build-2026/contracts";
import { motion, AnimatePresence } from "motion/react";
import Loader from "@/components/loader";

type Step = "loading" | "age" | "experience" | "goal" | "horizon" | "risk" | "budget" | "notes" | "done";

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>("loading");
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkState() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/onboarding`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as OnboardingState;
          if (data.complete) {
            setStep("done");
          } else {
            setStep("age");
          }
        } else {
          setStep("done"); // fallback gracefully
        }
      } catch (err) {
        setStep("done");
      }
    }
    checkState();
  }, []);

  const finish = async (finalAnswers: Partial<OnboardingAnswers>) => {
    setSubmitting(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(finalAnswers),
      });
      setStep("done");
    } catch (err) {
      console.error(err);
      setStep("done");
    }
  };

  const nextStep = (current: Step, update: Partial<OnboardingAnswers>) => {
    const nextAnswers = { ...answers, ...update };
    setAnswers(nextAnswers);

    switch (current) {
      case "age": return setStep("experience");
      case "experience": return setStep("goal");
      case "goal": return setStep("horizon");
      case "horizon": return setStep("risk");
      case "risk": return setStep("budget");
      case "budget": return setStep("notes");
      case "notes": return finish(nextAnswers);
      default: return setStep("done");
    }
  };

  if (step === "loading" || step === "done") {
    return null;
  }

  const renderContent = () => {
    switch (step) {
      case "age":
        return (
          <QuestionScreen
            title="How old are you?"
            onSkip={() => nextStep("age", { ageBand: null })}
          >
            {AGE_BANDS.map((b) => (
              <OptionButton key={b} onClick={() => nextStep("age", { ageBand: b })}>
                {b}
              </OptionButton>
            ))}
          </QuestionScreen>
        );
      case "experience":
        return (
          <QuestionScreen
            title="Have you invested before?"
            onSkip={() => nextStep("experience", { experience: null })}
          >
            {EXPERIENCES.map((e) => (
              <OptionButton key={e} onClick={() => nextStep("experience", { experience: e })}>
                {ONBOARDING_LABELS.experience[e]}
              </OptionButton>
            ))}
          </QuestionScreen>
        );
      case "goal":
        return (
          <QuestionScreen
            title="What are you hoping to get out of this?"
            onSkip={() => nextStep("goal", { primaryGoal: null })}
          >
            {PRIMARY_GOALS.map((g) => (
              <OptionButton key={g} onClick={() => nextStep("goal", { primaryGoal: g })}>
                {ONBOARDING_LABELS.primaryGoal[g]}
              </OptionButton>
            ))}
          </QuestionScreen>
        );
      case "horizon":
        return (
          <QuestionScreen
            title="When might you need this money back?"
            onSkip={() => nextStep("horizon", { horizon: null })}
          >
            {HORIZONS.map((h) => (
              <OptionButton key={h} onClick={() => nextStep("horizon", { horizon: h })}>
                {ONBOARDING_LABELS.horizon[h]}
              </OptionButton>
            ))}
          </QuestionScreen>
        );
      case "risk":
        return (
          <QuestionScreen
            title="If your investment dropped 20%, what would you do?"
            onSkip={() => nextStep("risk", { riskComfort: null })}
          >
            {RISK_COMFORTS.map((r) => (
              <OptionButton key={r} onClick={() => nextStep("risk", { riskComfort: r })}>
                {ONBOARDING_LABELS.riskComfort[r]}
              </OptionButton>
            ))}
          </QuestionScreen>
        );
      case "budget":
        return (
          <BudgetScreen
            onNext={(val) => nextStep("budget", { monthlyBudget: val })}
            onSkip={() => nextStep("budget", { monthlyBudget: null })}
          />
        );
      case "notes":
        return (
          <NotesScreen
            submitting={submitting}
            onNext={(val) => nextStep("notes", { notes: val })}
            onSkip={() => nextStep("notes", { notes: null })}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-lg"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function QuestionScreen({ title, children, onSkip }: { title: string; children: React.ReactNode; onSkip: () => void }) {
  return (
    <div className="space-y-8 flex flex-col items-center">
      <h2 className="text-3xl md:text-4xl font-bold text-center">{title}</h2>
      <div className="w-full space-y-3 flex flex-col">
        {children}
      </div>
      <Button variant="ghost" className="mt-4 text-muted-foreground hover:text-foreground" onClick={onSkip}>
        Skip this question
      </Button>
    </div>
  );
}

function OptionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full justify-start text-left h-auto py-4 px-6 text-lg rounded-2xl whitespace-normal font-medium bg-card border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function BudgetScreen({ onNext, onSkip }: { onNext: (val: number) => void; onSkip: () => void }) {
  const [val, setVal] = useState("");

  const handleNext = () => {
    const num = parseInt(val.replace(/\D/g, ""), 10);
    if (!isNaN(num)) onNext(num);
    else onSkip();
  };

  return (
    <QuestionScreen title="Roughly how much could you invest a month?" onSkip={onSkip}>
      <div className="flex gap-4 items-center">
        <span className="text-2xl font-bold text-muted-foreground">₹</span>
        <Input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="0"
          className="text-2xl py-6 rounded-xl text-center bg-card"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleNext();
          }}
        />
      </div>
      <Button size="lg" className="w-full rounded-2xl mt-4" onClick={handleNext}>
        Next
      </Button>
    </QuestionScreen>
  );
}

function NotesScreen({ onNext, onSkip, submitting }: { onNext: (val: string) => void; onSkip: () => void; submitting: boolean }) {
  const [val, setVal] = useState("");

  const handleNext = () => {
    if (val.trim()) onNext(val.trim());
    else onSkip();
  };

  return (
    <QuestionScreen title="Anything else we should know?" onSkip={onSkip}>
      <Textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Any specific goals, worries, or preferences..."
        className="text-lg rounded-xl bg-card min-h-[120px]"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleNext();
          }
        }}
      />
      <Button size="lg" className="w-full rounded-2xl mt-4" disabled={submitting} onClick={handleNext}>
        {submitting ? "Saving..." : "Finish"}
      </Button>
    </QuestionScreen>
  );
}
