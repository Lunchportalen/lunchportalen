// lib/enforce.ts
import "server-only";

import crypto from "node:crypto";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope } from "@/lib/auth/scope";

/* =========================================================
   Types
========================================================= */

export type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
export type CompanyStatus = "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED";

export type EnforcementErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "COMPANY_NOT_FOUND"
  | "COMPANY_BLOCKED"
  | "AGREEMENT_MISSING"
  | "AGREEMENT_INACTIVE"
  | "AGREEMENT_EXPIRED"
  | "DATE_CLOSED"
  | "CUTOFF_PASSED"
  | "INVALID_DATE";

export type EnforcementError = {
  ok: false;
  rid: string;
  error: EnforcementErrorCode;
  message: string;
  detail?: any;
};

export type Agreement = {
  id: string;
  company_id: string;
  status: "ACTIVE" | "PAUSED" | "CLOSED";
  plan_tier: string | null;
  start_date: string; // ISO date
  end_date: string | null;
  binding_months: number | null;
  delivery_days: string[] | null;
  cutoff_time: string | null; // "08:00"
  timezone: string | null; // "Europe/Oslo"
};

export type EnforcementContext = {
  rid: string;
  role: Role;
  company_id: string | null;
  user_id: string | null;
  email: string | null;
};

export type ClosedDateChecker = (isoDate: string) => Promise<boolean>;

export type EnforceWriteOk = {
  ok: true;
  ctx: EnforcementContext;
  company_id: string;
  agreement: Agreement;
};

export type EnforceWriteResult = EnforceWriteOk | EnforcementError;
export type EnforceCancelResult = EnforceWriteOk | EnforcementError;

/* =========================================================
   Helpers
========================================================= */

function mkRid() {
  return crypto.randomBytes(8).toString("hex");
}

function isIsoDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function todayOsloISO() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function timeOsloHHMM() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

function err(rid: string, error: EnforcementErrorCode, message: string, detail?: any): EnforcementError {
  return { ok: false, rid, error, message, detail: detail ?? undefined };
}

/**
 * getScope() hos dere kan være:
 * - getScope()
 * - getScope(req)
 * Denne wrapperen støtter begge uten TS-kræsj.
 */
async function getScopeSafe(req?: any) {
  try {
    if (req) return await (getScope as any)(req);
    return await (getScope as any)();
  } catch {
    return await (getScope as any)(req);
  }
}

function isErr(x: any): x is EnforcementError {
  return !!x && typeof x === "object" && x.ok === false;
}

/* =========================================================
   Audit hook (best effort)
========================================================= */

export async function auditEnforcementEvent(input: {
  ctx: EnforcementContext;
  action: string;
  reason: EnforcementErrorCode;
  endpoint?: string;
  extra?: any;
}) {
  try {
    const sb = await supabaseServer(); // ✅ await
    const { ctx, action, reason, endpoint, extra } = input;

    await sb.from("audit_events").insert({
      actor_user_id: ctx.user_id,
      actor_email: ctx.email,
      actor_role: ctx.role,
      action,
      entity_type: "company",
      entity_id: ctx.company_id,
      summary: `${reason}${endpoint ? ` @ ${endpoint}` : ""}`,
      detail: extra ?? null,
    });
  } catch {
    // ignore
  }
}

/* =========================================================
   Context
========================================================= */

export async function getEnforcementContext(req?: any): Promise<EnforcementContext | EnforcementError> {
  const rid = mkRid();

  const scope = await getScopeSafe(req);
  if (!scope?.ok) return err(rid, "UNAUTHENTICATED", "Ikke innlogget");

  const role = (scope.role ?? "employee") as Role;

  return {
    rid,
    role,
    company_id: scope.company_id ?? null,
    user_id: scope.user_id ?? null,
    email: scope.email ?? null,
  };
}

/* =========================================================
   Core fetchers
========================================================= */

async function readCompanyStatus(companyId: string) {
  const sb = await supabaseServer(); // ✅ await
  const { data, error } = await sb.from("companies").select("id,status").eq("id", companyId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return { id: String(data.id), status: String(data.status ?? "").toUpperCase() as CompanyStatus };
}

async function readCurrentAgreement(companyId: string): Promise<Agreement | null> {
  const sb = await supabaseServer(); // ✅ await

  const { data, error } = await sb
    .from("company_current_agreement")
    .select("id,company_id,status,plan_tier,start_date,end_date,binding_months,delivery_days,cutoff_time,timezone")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    company_id: String(data.company_id),
    status: String(data.status ?? "ACTIVE").toUpperCase() as any,
    plan_tier: (data.plan_tier ?? null) as any,
    start_date: String(data.start_date),
    end_date: data.end_date ? String(data.end_date) : null,
    binding_months: (data.binding_months ?? null) as any,
    delivery_days: (data.delivery_days ?? null) as any,
    cutoff_time: (data.cutoff_time ?? null) as any,
    timezone: (data.timezone ?? null) as any,
  };
}

/* =========================================================
   Guards (return typed payload OR typed error)
========================================================= */

async function guardCompanyActive(
  ctx: EnforcementContext,
  companyIdOverride?: string
): Promise<{ company_id: string } | EnforcementError> {
  const rid = ctx.rid;
  const company_id = companyIdOverride ?? ctx.company_id ?? null;

  if (ctx.role === "superadmin") {
    if (!company_id) return err(rid, "FORBIDDEN", "Superadmin må angi company_id for firma-spesifikke handlinger");
  } else {
    if (!company_id) return err(rid, "FORBIDDEN", "Mangler firmatilgang");
  }

  const row = await readCompanyStatus(company_id);
  if (!row) return err(rid, "COMPANY_NOT_FOUND", "Fant ikke firma");

  if (row.status !== "ACTIVE") {
    return err(rid, "COMPANY_BLOCKED", "Firmaet er deaktivert", { status: row.status });
  }

  return { company_id };
}

async function guardAgreementActive(ctx: EnforcementContext, company_id: string): Promise<Agreement | EnforcementError> {
  const rid = ctx.rid;

  const ag = await readCurrentAgreement(company_id);
  if (!ag) return err(rid, "AGREEMENT_MISSING", "Ingen aktiv avtale er registrert for firmaet");

  if (ag.status !== "ACTIVE") return err(rid, "AGREEMENT_INACTIVE", "Avtalen er ikke aktiv", { status: ag.status });

  const today = todayOsloISO();
  if (today < ag.start_date) {
    return err(rid, "AGREEMENT_INACTIVE", "Avtalen har ikke startet ennå", { start_date: ag.start_date });
  }
  if (ag.end_date && today > ag.end_date) {
    return err(rid, "AGREEMENT_EXPIRED", "Avtalen er utløpt", { end_date: ag.end_date });
  }

  return ag;
}

async function guardDateOpen(
  ctx: EnforcementContext,
  isoDate: string,
  isClosedDate?: ClosedDateChecker
): Promise<null | EnforcementError> {
  const rid = ctx.rid;

  if (!isIsoDate(isoDate)) return err(rid, "INVALID_DATE", "Ugyldig dato", { isoDate });

  if (isClosedDate) {
    const closed = await isClosedDate(isoDate);
    if (closed) return err(rid, "DATE_CLOSED", "Datoen er stengt for bestilling", { date: isoDate });
  }

  return null;
}

async function guardCancelCutoff(ctx: EnforcementContext, isoDate: string, cutoffHHMM = "08:00"): Promise<null | EnforcementError> {
  const rid = ctx.rid;

  if (!isIsoDate(isoDate)) return err(rid, "INVALID_DATE", "Ugyldig dato", { isoDate });

  const today = todayOsloISO();
  if (isoDate !== today) return null;

  const nowHHMM = timeOsloHHMM();
  if (nowHHMM >= cutoffHHMM) {
    return err(rid, "CUTOFF_PASSED", `Avbestilling stenger kl. ${cutoffHHMM} (Europe/Oslo)`, {
      now: nowHHMM,
      cutoff: cutoffHHMM,
      date: isoDate,
    });
  }

  return null;
}

/* =========================================================
   Convenience (clean unions, TS-safe narrowing)
========================================================= */

export async function enforceOrderWrite(input: {
  isoDate: string;
  companyIdOverride?: string;
  isClosedDate?: ClosedDateChecker;
  req?: any;
}): Promise<EnforceWriteResult> {
  const ctxOrErr = await getEnforcementContext(input.req);
  if (isErr(ctxOrErr)) return ctxOrErr;
  const ctx = ctxOrErr;

  const c = await guardCompanyActive(ctx, input.companyIdOverride);
  if (isErr(c)) return c;

  const ag = await guardAgreementActive(ctx, c.company_id);
  if (isErr(ag)) return ag;

  const dErr = await guardDateOpen(ctx, input.isoDate, input.isClosedDate);
  if (dErr) return dErr;

  return { ok: true, ctx, company_id: c.company_id, agreement: ag };
}

export async function enforceOrderCancel(input: {
  isoDate: string;
  companyIdOverride?: string;
  isClosedDate?: ClosedDateChecker;
  cutoffHHMM?: string;
  req?: any;
}): Promise<EnforceCancelResult> {
  const base = await enforceOrderWrite({
    isoDate: input.isoDate,
    companyIdOverride: input.companyIdOverride,
    isClosedDate: input.isClosedDate,
    req: input.req,
  });

  if (!base.ok) return base;

  const cutoff = input.cutoffHHMM ?? base.agreement.cutoff_time ?? "08:00";
  const cErr = await guardCancelCutoff(base.ctx, input.isoDate, cutoff);
  if (cErr) return cErr;

  return base;
}
