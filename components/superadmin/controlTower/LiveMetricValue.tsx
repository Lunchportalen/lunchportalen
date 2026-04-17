"use client";

import { motion } from "framer-motion";

/**
 * Tall som oppdateres: kort fade + scale (kun transform/opacity — GPU-vennlig).
 */
export function LiveMetricValue({
  value,
  className,
  children,
}: {
  value: string | number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.span
      key={String(value)}
      animate={{
        opacity: [0.78, 1, 0.88, 1],
        scale: [0.97, 1.012, 0.995, 1],
      }}
      transition={{ duration: 0.6, times: [0, 0.22, 0.5, 1], ease: "easeOut" }}
      className={`inline-block will-change-transform ${className ?? ""}`}
    >
      {children}
    </motion.span>
  );
}
