export const runtime = "nodejs";
export const revalidate = 0;

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabaseServer } from "@/lib/supabase/server";

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

export async function POST() {
  const supabase = await supabaseServer();

  // 1) Auth + superadmin-sjekk (RLS-policy krever superadmin for select/update)
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });
  }

  const { data: prof, error: pErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (pErr || !prof?.role || prof.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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
    return NextResponse.json({ ok: false, error: "DB_READ_FAILED", detail: qErr.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: "No pending emails." });
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

  return NextResponse.json({ ok: true, processed: rows.length, sent, failed });
}
