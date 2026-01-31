// app/api/admin/accept-invite/complete/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import crypto from "node:crypto";

import { jsonOk, jsonErr, rid as makeRid } from "@/lib/http/respond";
import { readJson } from "@/lib/http/routeGuard";

/* =========================================================
   Utils
========================================================= */
function safeText(v: unknown, max = 120) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/* =========================================================
   Supabase admin – LATE IMPORT (kritisk)
========================================================= */
type AdminClient = ReturnType<
  typeof import("@/lib/supabase/admin").supabaseAdmin
>;

async function getAdmin(): Promise<AdminClient> {
  // 🔑 Dette er nøkkelen: ingen env leses under build
  const mod = await import("@/lib/supabase/admin");
  return mod.supabaseAdmin();
}

/* =========================================================
   POST /api/admin/accept-invite/complete
========================================================= */
export async function POST(req: NextRequest) {
  const rid = makeRid();
  const ctx = { rid } as any;

  try {
    const body = await readJson(req);

    const token = String(body?.token ?? "").trim();
    const password = String(body?.password ?? "");
    const password2 = String(body?.password2 ?? "");
    const nameInput = safeText(body?.name ?? body?.full_name ?? body?.fullName, 120);

    if (!token) return jsonErr(ctx, "missing_token", "Mangler token.");
    if (!password || password.length < 10)
      return jsonErr(ctx, "bad_password", "Passord må være minst 10 tegn.");
    if (password2 && password !== password2)
      return jsonErr(ctx, "pw_mismatch", "Passordene er ikke like.");

    const admin = await getAdmin(); // ← LATE IMPORT
    const token_hash = sha256Hex(token);
    const nowIso = new Date().toISOString();

    const inv = await admin
      .from("employee_invites")
      .select("id,email,company_id,location_id,department,full_name,expires_at,used_at")
      .eq("token_hash", token_hash)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (inv.error) return jsonErr(ctx, "invite_lookup_failed", "Kunne ikke verifisere invitasjon.");
    if (!inv.data) return jsonErr(ctx, "invalid_token", "Ugyldig eller utløpt invitasjon.");

    const email = normEmail(inv.data.email);
    if (!isEmail(email)) return jsonErr(ctx, "invalid_email", "Ugyldig e-post.");

    const company_id = String(inv.data.company_id ?? "");
    if (!company_id) return jsonErr(ctx, "invite_corrupt", "Invitasjonen mangler company_id.");

    const full_name =
      nameInput?.trim() ||
      (inv.data.full_name?.trim() ?? null);

    const displayName = full_name || email;

    const create = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "employee",
        company_id,
        location_id: inv.data.location_id ?? null,
        department: inv.data.department ?? null,
        full_name,
        name: displayName,
      },
    });

    if (create.error) {
      return jsonErr(ctx, "auth_create_failed", "Kunne ikke opprette konto.", create.error.message);
    }

    await admin
      .from("employee_invites")
      .update({ used_at: nowIso })
      .eq("id", inv.data.id)
      .is("used_at", null);

    return jsonOk(ctx, { ok: true, rid, message: "Konto opprettet." });
  } catch (e: any) {
    return jsonErr(ctx, "server_error", "Uventet feil.", safeStr(e?.message ?? e));
  }
}

export async function GET(_req: NextRequest) {
  const rid = makeRid();
  const ctx = { rid } as any;
  return jsonErr(ctx, "method_not_allowed", "Bruk POST.", { method: "GET" });
}


