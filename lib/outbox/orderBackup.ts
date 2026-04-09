// STATUS: KEEP

// lib/outbox/orderBackup.ts
import nodemailer from "nodemailer";
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

type BackupEvent = {
  eventType: "SET_CHOICE" | "BULK_SET" | "CANCEL";
  company_id: string;
  location_id: string;
  user_id: string;
  date?: string; // YYYY-MM-DD
  dates?: string[]; // bulk
  payload: any; // hele API-resultatet du vil logge
};

export async function enqueueAndSendOrderBackup(evt: BackupEvent) {
  const supa = supabaseService();

  // 1) Insert PENDING outbox row
  const { data: row, error: insErr } = await (supa as any)
    .from("order_outbox")
    .insert({
      event_type: evt.eventType,
      company_id: evt.company_id,
      location_id: evt.location_id,
      user_id: evt.user_id,
      date: evt.date ?? null,
      dates: evt.dates ?? null,
      payload: evt.payload,
      status: "PENDING",
      attempts: 0,
    })
    .select("id")
    .single();

  if (insErr || !row?.id) {
    // Ikke blokker ordre - outbox er "best effort"
    console.error("[outbox] insert failed", insErr?.message);
    return { ok: false as const, stage: "insert", error: insErr?.message ?? "insert failed" };
  }

  const outboxId = row.id as string;

  // 2) Attempt send mail
  const to = assertEnv("ORDER_BACKUP_TO", process.env.ORDER_BACKUP_TO);
  const from = assertEnv("ORDER_BACKUP_FROM", process.env.ORDER_BACKUP_FROM);

  const subject = `[Lunchportalen] ${evt.eventType} ${evt.date ?? ""}`.trim();
  const text = JSON.stringify(
    {
      outboxId,
      eventType: evt.eventType,
      company_id: evt.company_id,
      location_id: evt.location_id,
      user_id: evt.user_id,
      date: evt.date ?? null,
      dates: evt.dates ?? null,
      payload: evt.payload,
    },
    null,
    2
  );

  try {
    const t = mailer();
    await t.sendMail({ from, to, subject, text });

    await (supa as any)
      .from("order_outbox")
      .update({ status: "SENT", sent_at: new Date().toISOString(), attempts: 1, last_error: null })
      .eq("id", outboxId);

    return { ok: true as const, outboxId };
  } catch (e: any) {
    const msg = String(e?.message ?? e);

    await (supa as any)
      .from("order_outbox")
      .update({ status: "FAILED", attempts: 1, last_error: msg })
      .eq("id", outboxId);

    // Ikke blokker ordre - bare logg
    console.error("[outbox] send failed", msg);
    return { ok: false as const, outboxId, stage: "send", error: msg };
  }
}
