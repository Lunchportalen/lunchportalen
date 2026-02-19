// superadmin/system/repairs/run/route.ts
//
// LUNCHPORTALEN — System Motor (SAFE / FAIL-CLOSED)
// - Eksport: runSystemMotor(...) slik cron kan kalle direkte (uten HTTP)
// - POST-endepunkt for superadmin (auth via scope + role)
// - Default: READ-ONLY sanity/repair-scan (ingen destruktive writes)
// - Writes kan kun aktiveres eksplisitt via env: SYSTEM_MOTOR_ENABLE_WRITES=true
//
// Viktig: Dette er en "driftsmotor" som skal være deterministisk og trygg.
// Den skal ikke gjøre “magiske” endringer uten at det er eksplisitt aktivert.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { isIsoDate } from "@/lib/date/oslo";

type MotorSource = "superadmin" | "cron";

export type RunSystemMotorInput = {
  rid: string;
  source: MotorSource;
  jobLimit?: number; // maks antall “jobber”/avvik vi rapporterer
  enqueueLimit?: number; // reservert for evt. senere queue (ikke brukt her)
  includeOrderIntegrity?: boolean;
};

export type RunSystemMotorResult = {
  ok: true;
  rid: string;
  source: MotorSource;
  executed_at: string;
  mode: "read_only" | "writes_enabled";
  limits: { jobLimit: number; enqueueLimit: number };
  summary: {
    scanned_orders_recent: number;
    anomalies_found: number;
    fixes_applied: number;
  };
  anomalies: string[]; // maks jobLimit
  notes: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function writesEnabled() {
  return String(process.env.SYSTEM_MOTOR_ENABLE_WRITES ?? "").trim().toLowerCase() === "true";
}

/**
 * Kjernefunksjon som cron kan kalle direkte.
 * NB: Hold denne “pure-ish”: ingen avhengighet til NextRequest.
 */
export async function runSystemMotor(input: RunSystemMotorInput): Promise<RunSystemMotorResult> {
  const rid = safeStr(input.rid) || makeRid();
  const jobLimit = clampInt(input.jobLimit, 1, 500, 25);
  const enqueueLimit = clampInt(input.enqueueLimit, 0, 5000, 0);
  const includeOrderIntegrity = input.includeOrderIntegrity !== false;

  const admin = supabaseAdmin();
  const anomalies: string[] = [];
  const notes: string[] = [];

  let scannedRecent = 0;
  let fixesApplied = 0;

  const mode: RunSystemMotorResult["mode"] = writesEnabled() ? "writes_enabled" : "read_only";

  // ----------------------------
  // ORDER INTEGRITY (read-only by default)
  // ----------------------------
  if (includeOrderIntegrity) {
    // 1) Missing critical fields
    try {
      const { data, error } = await admin
        .from("orders")
        .select("id,date,slot,company_id,location_id,created_at,updated_at")
        .or("company_id.is.null,location_id.is.null,slot.is.null,date.is.null")
        .limit(Math.min(jobLimit, 50));

      if (error) {
        anomalies.push(`orders_missing_fields_query_failed: ${safeStr(error.message)}`);
      } else {
        for (const row of data ?? []) {
          if (anomalies.length >= jobLimit) break;
          const o: any = row;
          anomalies.push(
            `order_missing_fields id=${o.id} date=${o.date ?? "null"} slot=${o.slot ?? "null"} company_id=${o.company_id ?? "null"} location_id=${o.location_id ?? "null"}`
          );
        }
      }
    } catch (e: any) {
      anomalies.push(`orders_missing_fields_exception: ${safeStr(e?.message ?? e)}`);
    }

    // 2) Recent scan (updated_at before created_at + invalid iso date)
    try {
      const { data, error } = await admin
        .from("orders")
        .select("id,date,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        anomalies.push(`orders_recent_scan_failed: ${safeStr(error.message)}`);
      } else {
        const rows = data ?? [];
        scannedRecent = rows.length;

        for (const row of rows) {
          if (anomalies.length >= jobLimit) break;
          const o: any = row;

          const created = o.created_at ? new Date(o.created_at).getTime() : NaN;
          const updated = o.updated_at ? new Date(o.updated_at).getTime() : NaN;

          if (Number.isFinite(created) && Number.isFinite(updated) && updated < created) {
            anomalies.push(`order_updated_before_created id=${o.id}`);
            // Vi fikser ikke timestamps automatisk (for risikabelt).
          }

          if (o.date && !isIsoDate(o.date)) {
            anomalies.push(`order_invalid_iso_date id=${o.id} date=${safeStr(o.date)}`);
          }
        }
      }
    } catch (e: any) {
      anomalies.push(`orders_recent_scan_exception: ${safeStr(e?.message ?? e)}`);
    }

    // 3) Valgfritt: “safe fix” hooks (kun hvis SYSTEM_MOTOR_ENABLE_WRITES=true)
    // Foreløpig: ingen automatiske fixes (for å unngå å ødelegge drift).
    if (mode === "writes_enabled") {
      notes.push("SYSTEM_MOTOR_ENABLE_WRITES=true er satt, men denne motoren gjør foreløpig ingen automatiske DB-fiks uten eksplisitt implementert policy.");
    } else {
      notes.push("READ-ONLY mode: motoren rapporterer avvik, men gjør ingen endringer.");
    }
  }

  return {
    ok: true,
    rid,
    source: input.source,
    executed_at: nowIso(),
    mode,
    limits: { jobLimit, enqueueLimit },
    summary: {
      scanned_orders_recent: scannedRecent,
      anomalies_found: anomalies.length,
      fixes_applied: fixesApplied,
    },
    anomalies,
    notes,
  };
}

/* =========================================================
   POST (Superadmin) — manuell kjøring via UI
========================================================= */
export async function POST(req: NextRequest) {
  const rid = makeRid();

  // Auth: superadmin only
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const denyRole = requireRoleOr403(a.ctx, "system.motor.run", ["superadmin"]);
  if (denyRole) return denyRole;

  // Body (valgfritt)
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const jobLimit = clampInt(body?.jobLimit, 1, 500, 25);
  const enqueueLimit = clampInt(body?.enqueueLimit, 0, 5000, 0);
  const includeOrderIntegrity = body?.includeOrderIntegrity !== false;

  try {
    const result = await runSystemMotor({
      rid,
      source: "superadmin",
      jobLimit,
      enqueueLimit,
      includeOrderIntegrity,
    });

    return jsonOk(rid, result, 200);
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke kjøre systemmotor.", 500, {
      code: "SYSTEM_MOTOR_FAILED",
      detail: { message: safeStr(e?.message ?? e) || "unknown_error" },
    });
  }
}
