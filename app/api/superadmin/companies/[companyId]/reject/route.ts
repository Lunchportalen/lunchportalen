// app/api/superadmin/companies/[companyId]/reject/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type RouteCtx = {
  params: { companyId: string } | Promise<{ companyId: string }>;
};

function noStore() {
  return { "Cache-Control": "no-store, max-age=0" };
}

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function cleanEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function safeName(v: any) {
  const s = safeStr(v);
  return s.length ? s : "der";
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function sendSmtpMail(params: { to: string; subject: string; text: string; replyTo?: string }) {
  let nodemailer: any;
  try {
    nodemailer = (await import("nodemailer")).default;
  } catch {
    throw new Error("nodemailer_not_installed");
  }

  const host = mustEnv("SMTP_HOST");
  const port = Number(mustEnv("SMTP_PORT"));
  const user = mustEnv("SMTP_USER");
  const pass = mustEnv("SMTP_PASS");
  const from = mustEnv("SMTP_FROM"); // f.eks: "Lunchportalen <post@lunchportalen.no>"

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
}

export async function POST(_req: Request, ctx: RouteCtx) {
  const { companyId } = await ctx.params;
  if (!isUuid(companyId)) return jsonError(400, "bad_request", "Ugyldig companyId");

  const sb = await supabaseServer();

  // ✅ Autorisasjon: må være superadmin
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr) return jsonError(401, "unauthorized", "Ikke innlogget", authErr);
  const role = String(auth?.user?.user_metadata?.role ?? "").toLowerCase();
  if (role !== "superadmin") return jsonError(403, "forbidden", "Kun superadmin kan avslå firma");

  // =========================================================
  // 1) Les firma (KUN sikre kolonner; unngår RLS på agreement_json)
  // =========================================================
  const { data: existing, error: exErr } = await sb
    .from("companies")
    .select("id,name,status,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (exErr) return jsonError(500, "db_error", "Kunne ikke lese firma", exErr);
  if (!existing) return jsonError(404, "not_found", "Firma finnes ikke");

  const currentStatus = String(existing.status ?? "").toLowerCase();

  // Idempotent: allerede closed -> ok (ikke send e-post på nytt)
  if (currentStatus === "closed") {
    return NextResponse.json({ ok: true, company: existing, meta: { alreadyClosed: true } }, { headers: noStore() });
  }

  // Kun pending -> closed
  if (currentStatus !== "pending") {
    return jsonError(409, "invalid_state", `Kan ikke avslå firma fra status '${existing.status}'.`, {
      status: existing.status,
    });
  }

  // =========================================================
  // 2) Oppdater status → closed
  // =========================================================
  const now = new Date().toISOString();

  const { data: updated, error: upErr } = await sb
    .from("companies")
    .update({ status: "closed", updated_at: now } as any)
    .eq("id", companyId)
    .select("id,name,status,updated_at")
    .single();

  if (upErr) return jsonError(500, "db_error", "Kunne ikke avslå firma", upErr);

  // =========================================================
  // 3) Hent agreement_json separat (best effort)
  //    - aldri la e-post/kolonne-tilgang stoppe avslå
  // =========================================================
  let agreement: any = null;
  try {
    const { data: agr } = await sb
      .from("companies")
      .select("agreement_json")
      .eq("id", companyId)
      .maybeSingle();
    agreement = (agr as any)?.agreement_json ?? null;
  } catch {
    agreement = null;
  }

  // =========================================================
  // 4) Send hyggelig avslag (best effort)
  // =========================================================
  const supportEmail = "post@lunchportalen.no";

  const to = cleanEmail(agreement?.admin?.email);
  const contactName = safeName(agreement?.admin?.full_name);
  const companyName = safeStr((updated as any)?.name) || "firmaet deres";

  let emailSent = false;
  let emailError: string | null = null;

  if (!to) {
    emailError = "missing_recipient_email";
  } else {
    const subject = "Lunchportalen – svar på registrering";
    const text =
      `Hei ${contactName},\n\n` +
      `Takk for forespørselen. Vi har dessverre ikke kapasitet til å ta inn ${companyName} på nåværende tidspunkt.\n\n` +
      `Dersom dere ønsker, kan dere svare på denne e-posten eller ta kontakt på ${supportEmail}, så kan vi se på muligheter fremover.\n\n` +
      `Vennlig hilsen\n` +
      `Lunchportalen`;

    try {
      await sendSmtpMail({ to, subject, text, replyTo: supportEmail });
      emailSent = true;
    } catch (e: any) {
      emailError = String(e?.message ?? e);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      company: updated,
      meta: {
        transitionedFrom: "pending",
        transitionedTo: "closed",
        emailSent,
        emailError,
      },
    },
    { headers: noStore() }
  );
}
