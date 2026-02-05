// lib/superadmin/rootMode.ts
import "server-only";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BreakGlassSession = {
  id: string;
  actor_id: string;
  purpose: string;
  note: string | null;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
};

export type SystemToggles = {
  enforce_cutoff: boolean;
  require_active_agreement: boolean;
  employee_self_service: boolean;
  company_admin_can_order: boolean;
  strict_mode: boolean;
  esg_engine: boolean;
  email_backup: boolean;
};

export type KillSwitch = {
  orders: boolean;
  cancellations: boolean;
  emails: boolean;
  kitchen_feed: boolean;
};

export type Retention = {
  orders_months: number;
  audit_years: number;
};

export type SystemSettings = {
  toggles: SystemToggles;
  killswitch: KillSwitch;
  retention: Retention;
  updated_at: string | null;
  updated_by: string | null;
};

export type Risk = {
  requiresRoot: boolean;
  severity: "normal" | "warn" | "danger";
  reasons: string[];
  plan: Array<{
    area: "TOGGLE" | "KILL" | "RETENTION";
    key: string;
    from: string;
    to: string;
    severity: "normal" | "warn" | "danger";
  }>;
};

function yn(v: any) {
  return v ? "ON" : "OFF";
}

export function ridFromReq(req: Request) {
  const h = req.headers.get("x-rid");
  const v = String(h ?? "").trim();
  return v || crypto.randomUUID();
}

export async function getActiveRootSession(sbAdmin: SupabaseClient, actorId: string) {
  // NB: tabellnavn må matche deres schema. Dette er det mest vanlige:
  // break_glass_sessions(actor_id, expires_at, ended_at)
  const nowIso = new Date().toISOString();

  const { data, error } = await sbAdmin
    .from("break_glass_sessions")
    .select("id,actor_id,purpose,note,started_at,expires_at,ended_at")
    .eq("actor_id", actorId)
    .is("ended_at", null)
    .gt("expires_at", nowIso)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return (data?.[0] as BreakGlassSession | undefined) ?? null;
}

export function buildRisk(prev: SystemSettings, next: SystemSettings): Risk {
  const plan: Risk["plan"] = [];

  // toggles
  (Object.keys(prev.toggles) as (keyof SystemToggles)[]).forEach((k) => {
    const a = prev.toggles[k];
    const b = next.toggles[k];
    if (a === b) return;
    plan.push({
      area: "TOGGLE",
      key: String(k),
      from: yn(a),
      to: yn(b),
      severity: k === "strict_mode" ? "warn" : "normal",
    });
  });

  // kills
  (Object.keys(prev.killswitch) as (keyof KillSwitch)[]).forEach((k) => {
    const a = prev.killswitch[k];
    const b = next.killswitch[k];
    if (a === b) return;
    plan.push({
      area: "KILL",
      key: String(k),
      from: yn(a),
      to: yn(b),
      severity: k === "orders" || k === "cancellations" ? "danger" : "warn",
    });
  });

  // retention
  (Object.keys(prev.retention) as (keyof Retention)[]).forEach((k) => {
    const a = prev.retention[k];
    const b = next.retention[k];
    if (a === b) return;
    plan.push({
      area: "RETENTION",
      key: String(k),
      from: String(a),
      to: String(b),
      severity: "warn",
    });
  });

  const reasons: string[] = [];
  let requiresRoot = false;
  let severity: Risk["severity"] = "normal";

  const has = (area: Risk["plan"][number]["area"], key: string) =>
    plan.some((p) => p.area === area && p.key === key);

  // Root policy:
  // - retention: alltid root
  // - kill orders/cancellations: root
  // - strict_mode toggle: root (valgfritt, men enterprise-riktig)
  if (plan.some((p) => p.area === "RETENTION")) {
    requiresRoot = true;
    reasons.push("RETENTION change requires root");
    severity = "warn";
  }
  if (has("KILL", "orders") || has("KILL", "cancellations")) {
    requiresRoot = true;
    reasons.push("Blocking orders/cancellations requires root");
    severity = "danger";
  }
  if (has("TOGGLE", "strict_mode")) {
    requiresRoot = true;
    reasons.push("Strict mode change requires root");
    if (severity !== "danger") severity = "warn";
  }

  // If any danger item exists → danger
  if (plan.some((p) => p.severity === "danger")) severity = "danger";

  // sort plan for readability
  const rank = (s: Risk["plan"][number]["severity"]) => (s === "danger" ? 0 : s === "warn" ? 1 : 2);
  plan.sort((a, b) => rank(a.severity) - rank(b.severity) || a.area.localeCompare(b.area));

  return { requiresRoot, severity, reasons, plan };
}

export async function requireRootIfNeeded(
  sbAdmin: SupabaseClient,
  actorId: string,
  risk: Risk
) {
  if (!risk.requiresRoot) return { ok: true, root: null as BreakGlassSession | null };

  const root = await getActiveRootSession(sbAdmin, actorId);
  if (!root) {
    return { ok: false, root: null as BreakGlassSession | null };
  }
  return { ok: true, root };
}
