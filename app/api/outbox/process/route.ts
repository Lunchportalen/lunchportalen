

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import nodemailer from "nodemailer";

function backoffMinutes(attempts: number) {
  // 0->1min, 1->5min, 2->15min, 3->60min, 4->180min, 5+->360min
  if (attempts <= 0) return 1;
  if (attempts === 1) return 5;
  if (attempts === 2) return 15;
  if (attempts === 3) return 60;
  if (attempts === 4) return 180;
  return 360;
}

function addMinutesISO(mins: number) {
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  const rid = makeRid();
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();

  // 1) Auth + superadmin-sjekk (RLS-policy krever superadmin for select/update)
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTH");
  }

  const { data: prof, error: pErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (pErr || !prof?.role || prof.role !== "superadmin") {
    return jsonErr(rid, "Mangler rettigheter.", 403, "FORBIDDEN");
  }

  // 2) SMTP
  const host = process.env.LP_SMTP_HOST!;
  const port = Number(process.env.LP_SMTP_PORT || "465");
  const secure = (process.env.LP_SMTP_SECURE || "true") === "true";
  const user = process.env.LP_SMTP_USER!;
  const pass = process.env.LP_SMTP_PASS!;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  // 3) Hent pending som er klare for forsøk
  const { data: rows, error: qErr } = await supabase
    .from("email_outbox")
    .select("id,event_key,mail_from,mail_to,subject,body_text,body_html,attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(20);

  if (qErr) {
    return jsonErr(rid, "Kunne ikke hente outbox.", 500, { code: "DB_READ_FAILED", detail: { message: qErr.message } });
  }

  if (!rows || rows.length === 0) {
    return jsonOk(rid, { processed: 0, message: "No pending emails." });
  }

  let sent = 0;
  let failed = 0;

  for (const r of rows) {
    try {
      await transporter.sendMail({
        from: r.mail_from,
        to: r.mail_to,
        subject: r.subject,
        text: r.body_text,
        html: r.body_html ?? undefined,
      });

      const { error: uErr } = await supabase
        .from("email_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", r.id);

      if (uErr) throw uErr;
      sent++;
    } catch (e: any) {
      const attempts = (r.attempts ?? 0) + 1;
      const nextAt = addMinutesISO(backoffMinutes(attempts));

      const { error: uErr } = await supabase
        .from("email_outbox")
        .update({
          attempts,
          last_error: e?.message ?? String(e),
          next_attempt_at: nextAt,
          // la den stå pending for retry, eller sett failed etter X forsøk:
          status: attempts >= 8 ? "failed" : "pending",
        })
        .eq("id", r.id);

      if (uErr) {
        // siste utvei: vi teller den som failed uansett
      }
      failed++;
    }
  }

  return jsonOk(rid, { processed: rows.length, sent, failed });
}





