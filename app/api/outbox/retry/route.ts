// app/api/outbox/retry/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import nodemailer from "nodemailer";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

function assertEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Server mangler env: ${name}`);
  return v;
}

function supabaseService() {
  return supabaseAdmin();
}

function mailer() {
  const host = assertEnv("SMTP_HOST", process.env.SMTP_HOST);
  const port = parseInt(assertEnv("SMTP_PORT", process.env.SMTP_PORT), 10);
  const user = assertEnv("SMTP_USER", process.env.SMTP_USER);
  const pass = assertEnv("SMTP_PASS", process.env.SMTP_PASS);
  const secure = (process.env.SMTP_SECURE ?? "false") === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function nowIso() {
  return new Date().toISOString();
}

type OutboxRow = {
  id: string;
  event_type: string;
  company_id: string;
  location_id: string;
  user_id: string;
  date: string | null;
  dates: any; // jsonb
  payload: any; // jsonb
  status: "PENDING" | "FAILED" | "SENT";
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

function buildMail(row: OutboxRow) {
  const to = assertEnv("ORDER_BACKUP_TO", process.env.ORDER_BACKUP_TO);
  const from = assertEnv("ORDER_BACKUP_FROM", process.env.ORDER_BACKUP_FROM);

  const subject = `[Lunchportalen] OUTBOX ${row.event_type} ${row.date ?? ""}`.trim();

  const text = JSON.stringify(
    {
      outboxId: row.id,
      eventType: row.event_type,
      company_id: row.company_id,
      location_id: row.location_id,
      user_id: row.user_id,
      date: row.date ?? null,
      dates: row.dates ?? null,
      payload: row.payload ?? null,
      attempts: row.attempts,
      created_at: row.created_at,
    },
    null,
    2
  );

  return { from, to, subject, text };
}

export async function POST(_req: Request) {
  const rid = makeRid();

  try {
    // Optional: protect with secret header if you want
    // const secret = process.env.CRON_SECRET;
    // if (secret) {
    //   const got = req.headers.get("x-cron-secret");
    // }

    const supa = supabaseService();
    const transporter = mailer();

    // Hent en liten batch som kan retryes
    // - PENDING: aldri sendt
    // - FAILED: retry hvis attempts < 10
    const { data: rowsRaw, error: rErr } = await (supa as any)
      .from("order_outbox")
      .select("id,event_type,company_id,location_id,user_id,date,dates,payload,status,attempts,last_error,created_at,sent_at")
      .in("status", ["PENDING", "FAILED"])
      .lt("attempts", 10)
      .order("created_at", { ascending: true })
      .limit(25);

    if (rErr) {
      return jsonErr(rid, "Kunne ikke lese outbox.", 500, { code: "READ_FAILED", detail: rErr.message });
    }

    const rows = (rowsRaw ?? []) as OutboxRow[];
    if (rows.length === 0) {
      return jsonOk(rid, { ok: true, rid, attempted: 0, sent: 0, failed: 0, message: "Nothing to retry." }, 200);
    }

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      // 1) mark as attempting (increment attempts)
      const nextAttempts = (row.attempts ?? 0) + 1;

      const { error: updAttemptErr } = await (supa as any)
        .from("order_outbox")
        .update({ attempts: nextAttempts, last_error: null })
        .eq("id", row.id);

      if (updAttemptErr) {
        failed++;
        continue;
      }

      // 2) try send
      try {
        const mail = buildMail({ ...row, attempts: nextAttempts });

        await transporter.sendMail(mail);

        // 3) mark as SENT
        const { error: updSentErr } = await (supa as any)
          .from("order_outbox")
          .update({ status: "SENT", sent_at: nowIso(), last_error: null })
          .eq("id", row.id);

        if (updSentErr) {
          failed++;
          continue;
        }

        sent++;
      } catch (e: any) {
        const msg = String(e?.message ?? e);

        await (supa as any)
          .from("order_outbox")
          .update({ status: "FAILED", last_error: msg })
          .eq("id", row.id);

        failed++;
      }
    }

    return jsonOk(rid, { ok: true, rid, attempted: rows.length, sent, failed }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: String(e?.message ?? e) });
  }
}
