"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";

interface SpiderTingleProps {
  isActive: boolean;
  className?: string;
}

export function SpiderTingle({ isActive, className = "" }: SpiderTingleProps) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="spider-tingle-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 1.0, ease: "easeInOut" },
          }}
          className={`fixed inset-x-0 top-16 md:top-20 pointer-events-none z-40 flex justify-between items-start px-4 sm:px-8 md:px-14 lg:px-20 w-full max-w-[1350px] mx-auto ${className}`}
          aria-hidden="true"
        >
          {/* Left Tingle Effect (Blue Squiggles) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.35, x: -30, rotate: -12 }}
            animate={{
              opacity: 1,
              scale: [1, 1.06, 0.97, 1.04, 1],
              x: [0, -3.5, 2.5, -2, 3, 0],
              y: [0, 2.5, -2.5, 1.5, -1.5, 0],
              rotate: [0, -2.5, 2, -1.5, 1, 0],
              filter: [
                "drop-shadow(0 0 6px rgba(37, 99, 235, 0.45))",
                "drop-shadow(0 0 16px rgba(59, 130, 246, 0.75))",
                "drop-shadow(0 0 8px rgba(37, 99, 235, 0.5))",
              ],
            }}
            exit={{
              opacity: 0,
              scale: 0.92,
              filter: "drop-shadow(0 0 0px rgba(59, 130, 246, 0)) blur(4px)",
              transition: { duration: 1.0, ease: "easeInOut" },
            }}
            transition={{
              scale: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
              x: { duration: 0.55, repeat: Infinity, ease: "easeInOut" },
              y: { duration: 0.65, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: 0.75, repeat: Infinity, ease: "easeInOut" },
              filter: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
              opacity: { type: "spring", stiffness: 450, damping: 20 },
            }}
            className="w-28 sm:w-36 md:w-44 lg:w-52 select-none shrink-0"
          >
            <img
              src="/spider-tingle-left.png"
              alt="Spider-tingle left"
              className="w-full h-auto object-contain pointer-events-none drop-shadow-sm"
              draggable={false}
            />
          </motion.div>

          {/* Right Tingle Effect (Red Squiggles) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.35, x: 30, rotate: 12 }}
            animate={{
              opacity: 1,
              scale: [1, 1.06, 0.97, 1.04, 1],
              x: [0, 3.5, -2.5, 2, -3, 0],
              y: [0, -2.5, 2.5, -1.5, 1.5, 0],
              rotate: [0, 2.5, -2, 1.5, -1, 0],
              filter: [
                "drop-shadow(0 0 6px rgba(220, 38, 38, 0.45))",
                "drop-shadow(0 0 16px rgba(239, 68, 68, 0.75))",
                "drop-shadow(0 0 8px rgba(220, 38, 38, 0.5))",
              ],
            }}
            exit={{
              opacity: 0,
              scale: 0.92,
              filter: "drop-shadow(0 0 0px rgba(239, 68, 68, 0)) blur(4px)",
              transition: { duration: 1.0, ease: "easeInOut", delay: 0.04 },
            }}
            transition={{
              scale: { duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.06 },
              x: { duration: 0.55, repeat: Infinity, ease: "easeInOut", delay: 0.06 },
              y: { duration: 0.65, repeat: Infinity, ease: "easeInOut", delay: 0.06 },
              rotate: { duration: 0.75, repeat: Infinity, ease: "easeInOut", delay: 0.06 },
              filter: { duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.06 },
              opacity: { type: "spring", stiffness: 450, damping: 20, delay: 0.03 },
            }}
            className="w-24 sm:w-32 md:w-40 lg:w-48 select-none shrink-0"
          >
            <img
              src="/spider-tingle-right.png"
              alt="Spider-tingle right"
              className="w-full h-auto object-contain pointer-events-none drop-shadow-sm"
              draggable={false}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
