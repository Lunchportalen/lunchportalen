// lib/markets/marketApprovals.ts
//
// FASE 10 — eierstyrt markedsaktivering (fail-closed).
// Registry-sannhet: et marked kan ALDRI fakturere uten status ACTIVE, og
// ACTIVE krever registrert skatte- OG legal-godkjenning (håndhevet i RPC + DB-triggere).
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const MARKET_APPROVAL_STATUSES = [
  "TECHNICALLY_READY",
  "TAX_REVIEW_PENDING",
  "TAX_APPROVED",
  "LEGAL_REVIEW_PENDING",
  "LEGAL_APPROVED",
  "ACTIVATION_BLOCKED",
  "ACTIVE",
] as const;

export type MarketApprovalStatus = (typeof MARKET_APPROVAL_STATUSES)[number];

export type MarketApprovalRow = {
  country_code: string;
  status: MarketApprovalStatus;
  tax_approved_at: string | null;
  legal_approved_at: string | null;
  activated_at: string | null;
  blocked_reason: string | null;
  notes: string | null;
  updated_at: string;
};

export async function listMarketApprovals(): Promise<MarketApprovalRow[]> {
  const admin = supabaseAdmin() as any;
  const { data, error } = await admin
    .from("market_approvals")
    .select("country_code, status, tax_approved_at, legal_approved_at, activated_at, blocked_reason, notes, updated_at")
    .order("country_code");
  if (error) throw new Error(`listMarketApprovals failed: ${error.message}`);
  return (data ?? []) as MarketApprovalRow[];
}

export async function transitionMarketApproval(p: {
  countryCode: string;
  newStatus: string;
  reason: string | null;
  actor: string | null;
}): Promise<{ ok: true; data: unknown } | { ok: false; code: string }> {
  const admin = supabaseAdmin() as any;
  const { data, error } = await admin.rpc("lp_market_approval_transition", {
    p_country_code: p.countryCode,
    p_new_status: p.newStatus,
    p_reason: p.reason,
    p_actor_user_id: p.actor,
  });
  if (error) return { ok: false, code: String(error.message ?? "TRANSITION_FAILED") };
  return { ok: true, data };
}

/** Kommersiell aktivering (fakturagate) — speiler DB-funksjonen. */
export async function isMarketCommerciallyActive(countryCode: string): Promise<boolean> {
  const admin = supabaseAdmin() as any;
  const { data } = await admin.rpc("lp_market_commercially_active", { p_country_code: countryCode });
  return data === true;
}
