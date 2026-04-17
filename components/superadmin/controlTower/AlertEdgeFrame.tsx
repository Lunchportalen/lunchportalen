"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect, type ReactNode } from "react";

type Props = {
  active: boolean;
  /** Økes for å trigge én shake-sekvens (transform translateX). */
  shakeNonce: number;
  children: ReactNode;
  className?: string;
  /** danger = rød kant (feil / kritisk); warn = amber (driftvarsler). */
  variant?: "danger" | "warn";
};

/**
 * Ring + lett skygge ved alarm; shake ved nytt shakeNonce uten å remounte barn.
 */
export function AlertEdgeFrame({ active, shakeNonce, children, className = "", variant = "danger" }: Props) {
  const ctrls = useAnimation();

  useEffect(() => {
    if (shakeNonce <= 0) return;
    void ctrls.start({
      x: [0, -5, 5, -3, 3, 0],
      transition: { duration: 0.45, ease: "easeOut" },
    });
  }, [shakeNonce, ctrls]);

  const edge =
    !active
      ? ""
      : variant === "warn"
        ? "rounded-2xl ring-2 ring-amber-500/65 shadow-lg shadow-amber-600/15"
        : "rounded-2xl ring-2 ring-red-500/70 shadow-lg shadow-red-500/25";

  return (
    <div className={[className, edge].join(" ")}>
      <motion.div animate={ctrls} style={{ willChange: "transform" }} className="min-w-0">
        {children}
      </motion.div>
    </div>
  );
}
