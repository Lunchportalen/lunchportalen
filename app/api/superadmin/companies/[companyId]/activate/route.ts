// app/api/superadmin/companies/[companyId]/activate/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type RouteCtx = {
  params: { companyId: string } | Promise<{ companyId: string }>;
};

function noStore() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function ok(body: any, status = 200) {
  return NextResponse.json({ ok: true, ...body }, { status, headers: noStore() });
}

function fail(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function safeStr(v: any) {
  return String(v ?? "").trim();
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
    // ✅ nodemailer eksporteres ikke alltid som default i ESM
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

type ActivateBody = { note?: string };

/**
 * Best-effort audit -> prøver audit_events først, fallback audit_log.
 * Feil her skal aldri stoppe aktivering.
 */
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
    };

    // 1) audit_events
    const a = await sb.from("audit_events").insert(row as any);
    if (!a.error) return;

    // 2) fallback audit_log (legacy) om tabell/kolonner ikke finnes
    if (isMissingTableError(a.error) || isMissingColumnError(a.error) || isPgMissingColumn(a.error)) {
      const b = await sb.from("audit_log").insert(row as any);
      if (!b.error) return;
    }
  } catch {
    return;
  }
}

export async function POST(req: Request, ctx: RouteCtx) {
  const rid = `sa_activate_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { companyId } = await ctx.params;
    if (!isUuid(companyId)) return fail(400, "bad_request", "Ugyldig companyId", { rid });

    // 0) Session (cookie)
    const sbUser = await supabaseServer();
    const { data: auth, error: authErr } = await sbUser.auth.getUser();
    if (authErr || !auth?.user) return fail(401, "unauthorized", "Ikke innlogget", { rid });

    // ✅ Hard superadmin-fasit på e-post
    const actorEmail = normEmail(auth.user.email);
    if (actorEmail !== "superadmin@lunchportalen.no") {
      return fail(403, "forbidden", "Kun superadmin kan aktivere firma", { rid });
    }

    const body = (await req.json().catch(() => ({}))) as ActivateBody;
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;

    // 1) Service role
    let sb: any;
    try {
      sb = supabaseAdmin();
    } catch (e: any) {
      return fail(500, "service_role_missing", "Mangler SUPABASE_SERVICE_ROLE_KEY i env.", {
        rid,
        error: String(e?.message ?? e),
      });
    }

    // 2) Les firma
    const { data: existing, error: exErr } = await sb
      .from("companies")
      .select("id,name,status,agreement_json,updated_at")
      .eq("id", companyId)
      .maybeSingle();

    if (exErr) return fail(500, "db_error", "Kunne ikke lese firma", { rid, exErr });
    if (!existing) return fail(404, "not_found", "Firma finnes ikke", { rid });

    const currentStatus = String(existing.status ?? "").toLowerCase();

    // ✅ Idempotent: allerede aktiv
    if (currentStatus === "active") {
      await tryAudit(sb, {
        actor_user_id: auth.user.id,
        actor_email: auth.user.email ?? null,
        actor_role: "superadmin",
        action: "company_activate_noop",
        entity_type: "company",
        entity_id: companyId,
        summary: "Already active",
        detail: { rid, status: "active" },
      });

      return ok({ rid, company: existing, meta: { alreadyActive: true } });
    }

    if (currentStatus !== "pending") {
      return fail(409, "invalid_state", `Kan ikke aktivere firma fra status '${existing.status}'.`, {
        rid,
        status: existing.status,
      });
    }

    // 3) Update -> active (schema-safe)
    const now = new Date().toISOString();

    // prøv rik update først (hvis kolonner finnes)
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
      // fallback på garanterte felt
      up = await sb
        .from("companies")
        .update({ status: "active", updated_at: now } as any)
        .eq("id", companyId)
        .select("id,name,status,agreement_json,updated_at")
        .single();
    }

    if (up.error) return fail(500, "db_error", "Kunne ikke aktivere firma", { rid, upErr: up.error });

    // 3.1) Audit (best-effort)
    await tryAudit(sb, {
      actor_user_id: auth.user.id,
      actor_email: auth.user.email ?? null,
      actor_role: "superadmin",
      action: "company_activate",
      entity_type: "company",
      entity_id: companyId,
      summary: "Pending -> Active",
      detail: { rid, from: "pending", to: "active", note },
      created_at: now,
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

    return ok({
      rid,
      company: up.data,
      meta: {
        transitionedFrom: "pending",
        transitionedTo: "active",
        emailSent,
        emailError,
      },
    });
  } catch (e: any) {
    return fail(500, "server_error", "Uventet feil i aktivering.", {
      rid,
      error: String(e?.message ?? e),
    });
  }
}
