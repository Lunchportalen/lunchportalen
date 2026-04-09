/**
 * Multi-objective optimization (MOO) — types for deterministic scoring (no I/O).
 */

export type MooOrderRow = {
  total_amount?: number | string | null;
};

export type MooSessionRow = {
  user_id?: string | null;
  session_id?: string | null;
};

export type MooLogRow = {
  action?: string | null;
  metadata?: { duration?: number | null } | null;
};

export type MooRawMetrics = {
  revenue: number;
  orders: number;
  retention: number;
  dwellTime: number;
};

export type MooNormalized = {
  revenue: number;
  retention: number;
  dwell: number;
};
