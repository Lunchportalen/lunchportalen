// app/api/superadmin/companies/[companyId]/activate/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";

/* =========================
   Types
========================= */
type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };
type ActivateBody = { note?: string };

/* =========================
   Utils
========================= */
function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normEmail(v: any) {
  return safeStr(v).toLowerCase();
}
function safeName(v: any) {
  const s = safeStr(v);
  return s.length ? s : "der";
}
function env(name: string): string | null {
  const v = process.env[name];
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  const m = msg.toLowerCase();
  return m.includes("could not find the") && m.includes("column");
}
function isPgMissingColumn(err: any) {
  // Postgres undefined_column = 42703
  const code = String(err?.code ?? "");
  return code === "42703" || String(err?.message ?? "").toLowerCase().includes("does not exist");
}
function isMissingTableError(err: any) {
  const code = String(err?.code ?? "");
  // Postgres undefined_table = 42P01
  return code === "42P01" || String(err?.message ?? "").toLowerCase().includes("does not exist");
}

/* =========================
   Best-effort email
========================= */
type MailResult = { sent: boolean; error: string | null };

async function trySendMail(params: { to: string; subject: string; text: string; replyTo?: string }): Promise<MailResult> {
  const host = env("SMTP_HOST");
  const portRaw = env("SMTP_PORT");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  const from = env("SMTP_FROM");

  if (!host || !portRaw || !user || !pass || !from) return { sent: false, error: "smtp_env_missing" };

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) return { sent: false, error: "smtp_port_invalid" };

  let nodemailer: any;
  try {
    nodemailer = await import("nodemailer");
  } catch {
    return { sent: false, error: "nodemailer_not_installed" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      replyTo: params.replyTo,
    });

    return { sent: true, error: null };
  } catch (e: any) {
    return { sent: false, error: String(e?.message ?? e) };
  }
}

/* =========================
   Best-effort audit
========================= */
async function tryAudit(
  sb: any,
  payload: {
    actor_user_id?: string | null;
    actor_email?: string | null;
    actor_role?: string | null;
    action: string;
    entity_type?: string | null;
    entity_id?: string | null;
    summary?: string | null;
    detail?: any;
    created_at?: string;
    rid?: string | null;
  }
) {
  try {
    const now = payload.created_at ?? new Date().toISOString();
    const row = {
      actor_user_id: payload.actor_user_id ?? null,
      actor_email: payload.actor_email ?? null,
      actor_role: payload.actor_role ?? null,
      action: payload.action,
      entity_type: payload.entity_type ?? "company",
      entity_id: payload.entity_id ?? null,
      summary: payload.summary ?? null,
      detail: payload.detail ?? null,
      created_at: now,
      rid: payload.rid ?? null,
    };

    const a = await sb.from("audit_events").insert(row as any);
    if (!a.error) return;

    if (isMissingTableError(a.error) || isMissingColumnError(a.error) || isPgMissingColumn(a.error)) {
      await sb.from("audit_log").insert(row as any);
    }
  } catch {
    // best effort
  }
}

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(401, { rid }, "UNAUTHENTICATED", "Du må være innlogget.");
}

/* =========================
   POST
========================= */
export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.activate.POST", ["superadmin"]);
  if (deny) return deny;

  const params = await ctx.params;
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(400, a, "BAD_REQUEST", "Ugyldig companyId.");

  const body = ((await readJson(req)) ?? {}) as ActivateBody;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;

  let sb: any;
  try {
    sb = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(500, a, "SERVICE_ROLE_MISSING", "Mangler SUPABASE_SERVICE_ROLE_KEY i env.", {
      error: String(e?.message ?? e),
    });
  }

  try {
    // 1) Les firma
    const { data: existing, error: exErr } = await sb
      .from("companies")
      .select("id,name,status,agreement_json,updated_at")
      .eq("id", companyId)
      .maybeSingle();

    if (exErr) return jsonErr(500, a, "DB_ERROR", "Kunne ikke lese firma.", exErr);
    if (!existing) return jsonErr(404, a, "NOT_FOUND", "Firma finnes ikke.");

    const currentStatus = String((existing as any).status ?? "").toLowerCase();

    // 2) Idempotent: allerede aktiv
    if (currentStatus === "active") {
      await tryAudit(sb, {
        actor_user_id: a.scope?.userId ?? null,
        actor_email: a.scope?.email ?? null,
        actor_role: "superadmin",
        action: "company_activate_noop",
        entity_type: "company",
        entity_id: companyId,
        summary: "Already active",
        detail: { from: currentStatus, to: "active" },
        rid: a.rid,
      });

      return jsonOk(a, { ok: true, rid: a.rid, company: existing, meta: { alreadyActive: true } }, 200);
    }

    if (currentStatus !== "pending") {
      return jsonErr(409, a, "INVALID_STATE", `Kan ikke aktivere firma fra status '${(existing as any).status}'.`, {
        status: (existing as any).status,
      });
    }

    // 3) Update -> active (schema-safe)
    const now = new Date().toISOString();

    let up = await sb
      .from("companies")
      .update(
        {
          status: "active",
          activated_at: now,
          activation_note: note,
          updated_at: now,
        } as any
      )
      .eq("id", companyId)
      .select("id,name,status,agreement_json,updated_at")
      .single();

    if (up.error && (isMissingColumnError(up.error) || isPgMissingColumn(up.error))) {
      up = await sb
        .from("companies")
        .update({ status: "active", updated_at: now } as any)
        .eq("id", companyId)
        .select("id,name,status,agreement_json,updated_at")
        .single();
    }

    if (up.error) return jsonErr(500, a, "DB_ERROR", "Kunne ikke aktivere firma.", up.error);

    // 3.1) Audit (best effort)
    await tryAudit(sb, {
      actor_user_id: a.scope?.userId ?? null,
      actor_email: a.scope?.email ?? null,
      actor_role: "superadmin",
      action: "company_activate",
      entity_type: "company",
      entity_id: companyId,
      summary: "Pending -> Active",
      detail: { from: "pending", to: "active", note },
      created_at: now,
      rid: a.rid,
    });

    // 4) Email (best effort)
    const supportEmail = "ordre@lunchportalen.no";
    const appUrl = (env("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
    const loginUrl = `${appUrl}/login`;

    const agreement = (up.data as any)?.agreement_json ?? null;
    const to = normEmail(agreement?.admin?.email);
    const contactName = safeName(agreement?.admin?.full_name);
    const companyName = safeStr((up.data as any)?.name) || "firmaet deres";

    let emailSent = false;
    let emailError: string | null = null;

    if (!to) {
      emailError = "missing_recipient_email";
    } else {
      const subject = "Velkommen til Lunchportalen – avtalen er aktivert";
      const text =
        `Hei ${contactName},\n\n` +
        `Takk for registreringen. Avtalen for ${companyName} er nå aktivert.\n\n` +
        `Neste steg:\n` +
        `1) Logg inn her: ${loginUrl}\n` +
        `2) Gå til Admin og legg til ansatte\n\n` +
        `Har dere spørsmål eller ønsker rask oppstart, svar gjerne på denne e-posten eller kontakt oss på ${supportEmail}.\n\n` +
        `Vennlig hilsen\nLunchportalen\n`;

      const mail = await trySendMail({ to, subject, text, replyTo: supportEmail });
      emailSent = mail.sent;
      emailError = mail.sent ? null : mail.error;
    }

    return jsonOk(
      a,
      {
        ok: true,
        rid: a.rid,
        company: up.data,
        meta: {
          transitionedFrom: "pending",
          transitionedTo: "active",
          emailSent,
          emailError,
        },
      },
      200
    );
  } catch (e: any) {
    return jsonErr(500, a, "SERVER_ERROR", "Uventet feil i aktivering.", {
      message: String(e?.message ?? e),
    });
  }
}

