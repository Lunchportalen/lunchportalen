// app/api/admin/invites/resend/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 helpers
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

// Optional: if you have a mail/outbox helper already, you can swap this out.
// This route will still function without sending email (it returns the URL for UI to copy).
import crypto from "node:crypto";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normEmail(v: any) {
  return safeStr(v).toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function randomCode(bytes = 18) {
  return crypto.randomBytes(bytes).toString("base64url");
}

type InviteRow = {
  id: string;
  company_id: string;
  email: string;
  location_id: string | null;
  department: string | null;
  full_name: string | null;
  expires_at: string | null;
  used_at: string | null;
  revoked_at?: string | null;
  created_at: string | null;
  created_by: string | null;
};

export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // 1) Scope
  const a = await scopeOr401(req);
  if (a instanceof Response) return a;
  const ctx = a.ctx;

  // 2) Role gate (company_admin only)
  const denyRole = requireRoleOr403(ctx, "admin.invites.resend", ["company_admin"]);
  if (denyRole) return denyRole;

  // 3) Company scope
  const denyScope = requireCompanyScopeOr403(ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(ctx.scope.companyId);
  const actorId = safeStr(ctx.scope.userId);

  if (!companyId) return jsonErr(ctx, "missing_company", "Mangler company_id i scope.");
  if (!actorId) return jsonErr(ctx, "not_authenticated", "Ikke innlogget.");

  // 4) Body
  const body = await readJson(req);
  const inviteId = safeStr(body?.inviteId ?? body?.id);
  const email = normEmail(body?.email);

  if (!inviteId && !email) {
    return jsonErr(ctx, "bad_request", "Mangler inviteId eller email.", {
      required: ["inviteId OR email"],
    });
  }
  if (email && !isEmail(email)) {
    return jsonErr(ctx, "bad_request", "Ugyldig e-post.", { email });
  }

  try {
    const admin = supabaseAdmin();

    // 5) Lookup invite (must belong to company, must be unused)
    let q = admin
      .from("employee_invites")
      .select("id, company_id, email, location_id, department, full_name, expires_at, used_at, created_at, created_by")
      .eq("company_id", companyId)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (inviteId) q = q.eq("id", inviteId);
    if (!inviteId && email) q = q.eq("email", email);

    const { data: found, error: findErr } = await q.maybeSingle<InviteRow>();

    if (findErr) {
      return jsonErr(ctx, "db_error", "Kunne ikke hente invitasjon.", { message: findErr.message });
    }
    if (!found) {
      return jsonErr(ctx, "not_found", "Fant ingen aktiv invitasjon å sende på nytt.", {
        inviteId: inviteId || null,
        email: email || null,
      });
    }

    // 6) Generate new token (we store token_hash; token returned to UI)
    // NOTE: This assumes your employee_invites table stores token_hash and you have an accept endpoint
    // at /api/accept-invite/complete which expects token (not hash).
    const token = randomCode(24);
    const token_hash = crypto.createHash("sha256").update(token).digest("hex");

    // default expiry: keep existing expires_at if it’s in the future; else extend 48h
    const now = new Date();
    const nowIso = now.toISOString();
    const curExp = found.expires_at ? new Date(found.expires_at) : null;
    const expiresAt =
      curExp && curExp.getTime() > now.getTime()
        ? curExp.toISOString()
        : new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    // 7) Update invite with new token_hash + new expires_at (keeps same row id)
    const { error: updErr } = await admin
      .from("employee_invites")
      .update({
        token_hash,
        expires_at: expiresAt,
        // Optional fields if you have them; safe even if columns don't exist? (PostgREST will error)
        // resent_at: nowIso,
        // resent_by: actorId,
      })
      .eq("id", found.id)
      .eq("company_id", companyId)
      .is("used_at", null);

    if (updErr) {
      return jsonErr(ctx, "db_error", "Kunne ikke oppdatere invitasjon.", { message: updErr.message });
    }

    // 8) Build URL (UI can copy / or you can enqueue mail elsewhere)
    const base = safeStr(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "") || "http://localhost:3000";
    const acceptUrl = `${base}/accept-invite?token=${encodeURIComponent(token)}`;

    // (Optional) If you have an outbox table, enqueue here. We don't assume it exists.
    // If you want mail-outbox, tell me which table + columns.

    return jsonOk(ctx, {
      ok: true,
      companyId,
      invite: {
        id: found.id,
        email: found.email,
        location_id: found.location_id,
        department: found.department,
        full_name: found.full_name,
        expires_at: expiresAt,
      },
      resend: {
        token, // return token so UI can copy/send (do not log it)
        url: acceptUrl,
        resent_at: nowIso,
        resent_by: actorId,
      },
      note: "Invitasjonen er fornyet. Send lenken videre (eller koble på e-post-outbox).",
    });
  } catch (e: any) {
    return jsonErr(ctx, "server_error", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}


