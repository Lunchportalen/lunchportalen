// STATUS: KEEP

// lib/enforce.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/* =========================================================
   Types
========================================================= */

export type CompanyStatus = "active" | "paused" | "closed";

export type EnforcementAction = "ENFORCEMENT_ALLOW" | "ENFORCEMENT_BLOCK";
export type EnforcementEntityType = "order" | "company" | "profile" | "system";

export type EnforcementDecision =
  | {
      ok: true;
      rid: string;
      action: "ENFORCEMENT_ALLOW";
    }
  | {
      ok: false;
      rid: string;
      action: "ENFORCEMENT_BLOCK";
      status: CompanyStatus;
      reason: string;
      message: string;
      detail?: any;
    };

export type AuditEnforcementInput = {
  rid: string;
  action: "ENFORCEMENT_BLOCK" | "ENFORCEMENT_ALLOW";

  entity_type: EnforcementEntityType;
  entity_id: string; // ✅ hard krav

  company_id?: string | null;
  actor_user_id?: string | null;

  route?: string | null;
  reason?: string | null;
  detail?: any;
};

/* =========================================================
   Helpers
========================================================= */

function mustStr(name: string, v: any) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`audit_missing_${name}`);
  return s;
}

function normStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "active" || s === "paused" || s === "closed") return s;
  return "paused"; // safest default
}

/* =========================================================
   HARD AUDIT
========================================================= */

export async function auditEnforcementEvent(sb: SupabaseClient, input: AuditEnforcementInput) {
  const rid = mustStr("rid", input.rid);
  const action = mustStr("action", input.action) as AuditEnforcementInput["action"];

  const entity_type = mustStr("entity_type", input.entity_type) as EnforcementEntityType;
  const entity_id = mustStr("entity_id", input.entity_id); // ✅ stopper null/empty

  const payload = {
    rid,
    action,
    entity_type,
    entity_id,
    company_id: input.company_id ?? null,
    actor_user_id: input.actor_user_id ?? null,
    route: input.route ?? null,
    reason: input.reason ?? null,
    detail: input.detail ?? null,
  };

  const { error } = await sb.from("audit_events").insert(payload);

  if (error) {
    const e = new Error(`AUDIT_INSERT_FAILED: ${error.message}`);
    (e as any).cause = error;
    (e as any).payload = payload;
    throw e; // ✅ HARD FAIL
  }

  return { ok: true as const };
}

/* =========================================================
   Gates
========================================================= */

async function enforceCompanyActiveOrBlock(args: {
  sb: SupabaseClient;
  rid: string;

  companyStatus: CompanyStatus;
  company_id: string | null;
  actor_user_id: string | null;

  entity_type: EnforcementEntityType;
  entity_id: string;

  route: string;
  reason: string;
  detail?: any;
}): Promise<EnforcementDecision> {
  const status = normStatus(args.companyStatus);

  if (status === "active") {
    return { ok: true, rid: args.rid, action: "ENFORCEMENT_ALLOW" };
  }

  await auditEnforcementEvent(args.sb, {
    rid: args.rid,
    action: "ENFORCEMENT_BLOCK",
    entity_type: args.entity_type,
    entity_id: args.entity_id,
    company_id: args.company_id,
    actor_user_id: args.actor_user_id,
    route: args.route,
    reason: args.reason,
    detail: { status, ...args.detail },
  });

  return {
    ok: false,
    rid: args.rid,
    action: "ENFORCEMENT_BLOCK",
    status,
    reason: args.reason,
    message: `Blocked: company status is ${status}`,
    detail: args.detail,
  };
}

export async function enforceOrderCancel(args: {
  sb: SupabaseClient;
  rid: string;

  companyStatus: CompanyStatus;
  company_id: string | null;
  actor_user_id: string | null;

  orderId: string;
  route: string;
}): Promise<EnforcementDecision> {
  return enforceCompanyActiveOrBlock({
    sb: args.sb,
    rid: args.rid,
    companyStatus: args.companyStatus,
    company_id: args.company_id,
    actor_user_id: args.actor_user_id,
    entity_type: "order",
    entity_id: args.orderId,
    route: args.route,
    reason: "COMPANY_STATUS_NOT_ACTIVE",
    detail: { op: "cancel" },
  });
}

export async function enforceOrderToggleCancel(args: {
  sb: SupabaseClient;
  rid: string;

  companyStatus: CompanyStatus;
  company_id: string | null;
  actor_user_id: string | null;

  orderId: string;
  route: string;
}): Promise<EnforcementDecision> {
  return enforceCompanyActiveOrBlock({
    sb: args.sb,
    rid: args.rid,
    companyStatus: args.companyStatus,
    company_id: args.company_id,
    actor_user_id: args.actor_user_id,
    entity_type: "order",
    entity_id: args.orderId,
    route: args.route,
    reason: "COMPANY_STATUS_NOT_ACTIVE",
    detail: { op: "toggle_cancel" },
  });
}
