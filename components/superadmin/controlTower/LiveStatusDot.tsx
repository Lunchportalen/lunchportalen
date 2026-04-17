"use client";

import { motion } from "framer-motion";

import type { DataTrustKind } from "@/components/superadmin/DataTrustBadge";

const BG: Record<DataTrustKind, string> = {
  REAL: "bg-emerald-500",
  ESTIMATED: "bg-amber-400",
  DEMO: "bg-violet-500",
};

const DURATION: Record<DataTrustKind, number> = {
  REAL: 2,
  ESTIMATED: 2.6,
  DEMO: 2.2,
};

const TITLE: Record<DataTrustKind, string> = {
  REAL: "Sanntidsdata (målt)",
  ESTIMATED: "Estimert / modellert",
  DEMO: "Demo",
};

/** Pulserende statusprikk — kun opacity (GPU-trygt). */
export function LiveStatusDot({ kind }: { kind: DataTrustKind }) {
  return (
    <motion.span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${BG[kind]}`}
      animate={{ opacity: [1, 0.38, 1] }}
      transition={{
        duration: DURATION[kind],
        repeat: Infinity,
        ease: "easeInOut",
      }}
      aria-hidden
      title={TITLE[kind]}
    />
  );
}
