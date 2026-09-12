"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@bit-n-build-2026/ui/components/button";
import { motion, AnimatePresence } from "motion/react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { TimeMachineBar } from "./demo/time-machine-bar";

export default function Header() {
  const [isExpanded, setIsExpanded] = useState(false);

  const links = [
    { to: "/", label: "THWIP" },
    { to: "/chat", label: "Chat" },
    { to: "/portfolio", label: "Portfolio" },
    { to: "/compare", label: "Compare" },
  ] as const;

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex flex-row items-center justify-between px-4 py-3">
        <nav className="flex items-center gap-6 text-lg font-bold">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} href={to} className="transition-colors hover:text-primary">
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 h-10">
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden whitespace-nowrap flex items-center pr-2"
              >
                <TimeMachineBar compact />
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            variant={isExpanded ? "default" : "outline"}
            onClick={() => setIsExpanded((prev) => !prev)}
            className="h-9 px-3 font-mono text-sm font-bold tracking-wide flex items-center gap-2 border-primary/40 bg-card hover:bg-accent shadow-xs cursor-pointer transition-all"
          >
            <span>Days</span>
            {isExpanded ? (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>

          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

