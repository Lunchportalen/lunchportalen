// app/api/admin/employees/invites/resend/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import nodemailer from "nodemailer";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function safeUUID(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const ok =
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(s);
  return ok ? s : null;
}

async function requireCompanyAdmin() {
  const sb = await supabaseServer();
  const { data: auth, error: uerr } = await sb.auth.getUser();
  const user = auth?.user ?? null;
  if (uerr || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });

  const { data: profile, error: perr } = await sb
    .from("profiles")
    .select("user_id, company_id, role, disabled_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perr) throw Object.assign(new Error("db_error"), { code: "db_error", detail: perr });
  if (profile?.disabled_at) throw Object.assign(new Error("account_disabled"), { code: "account_disabled" });

  const roleDb = String(profile?.role ?? "").trim().toLowerCase();
  const roleMeta = String(user.user_metadata?.role ?? "").trim().toLowerCase();
  const role = (roleDb || roleMeta || "employee") as Role;
  if (role !== "company_admin") throw Object.assign(new Error("forbidden"), { code: "forbidden" });

  const companyId = profile?.company_id ? String(profile.company_id) : "";
  if (!companyId) throw Object.assign(new Error("missing_company"), { code: "missing_company" });

  return { companyId };
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function sendInviteEmail(to: string, link: string) {
  const host = mustEnv("SMTP_HOST");
  const port = Number(mustEnv("SMTP_PORT"));
  const user = mustEnv("SMTP_USER");
  const pass = mustEnv("SMTP_PASS");
  const from = process.env.SMTP_FROM || user;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const subject = "Invitasjon til Lunchportalen";
  const text =
    `Du er invitert til Lunchportalen.\n\n` +
    `Åpne denne lenken for å akseptere invitasjonen og sette passord:\n${link}\n\n` +
    `Hvis du ikke forventet denne e-posten, kan du ignorere den.`;

  await transport.sendMail({ from, to, subject, text });
}

export async function POST(req: Request) {
  const rid = `inv_resend_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { companyId } = await requireCompanyAdmin();
    const body = await req.json().catch(() => ({}));

    const inviteId = safeUUID(body.inviteId ?? body.id);
    if (!inviteId) return jsonError(400, "invalid_invite_id", "Ugyldig inviteId.", { rid });

    const admin = supabaseAdmin();

    // Hent invite (må tilhøre firma, ikke brukt)
    const cur = await admin
      .from("employee_invites")
      .select("id, email, token_hash, expires_at, used_at")
      .eq("id", inviteId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (cur.error) return jsonError(500, "invite_read_failed", "Kunne ikke hente invitasjon.", { rid, detail: cur.error });
    if (!cur.data) return jsonError(404, "invite_not_found", "Invitasjon ikke funnet.", { rid });
    if (cur.data.used_at) return jsonError(400, "already_used", "Invitasjonen er allerede brukt.", { rid });

    // Lag NY token (rotasjon)
    const token = crypto.randomBytes(32).toString("hex");
    const newHash = crypto.createHash("sha256").update(token).digest("hex");
    const oldHash = String(cur.data.token_hash);

    const appUrl = mustEnv("PUBLIC_APP_URL").replace(/\/$/, "");
    const link = `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`;

    // Vi oppdaterer først token_hash, men ruller tilbake hvis sending feiler.
    // (Da beholder vi gammel link gyldig ved send-feil.)
    const newExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 dager

    const upd1 = await admin
      .from("employee_invites")
      .update({ token_hash: newHash, expires_at: newExpiry })
      .eq("id", inviteId)
      .eq("company_id", companyId)
      .is("used_at", null);

    if (upd1.error) return jsonError(500, "invite_update_failed", "Kunne ikke oppdatere invitasjon.", { rid, detail: upd1.error });

    try {
      // SEND E-POST
      await sendInviteEmail(String(cur.data.email), link);

      // Markér last_sent_at etter suksess
      const upd2 = await admin
        .from("employee_invites")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", inviteId)
        .eq("company_id", companyId);

      if (upd2.error) {
        // Ikke kritisk; vi returnerer ok men med warning
        return jsonOk({ ok: true, rid, message: "Invitasjon sendt (men last_sent_at kunne ikke oppdateres).", warning: upd2.error });
      }

      return jsonOk({ ok: true, rid, message: "Invitasjon sendt på nytt." });
    } catch (mailErr: any) {
      // ROLLBACK token_hash -> gammel (så vi ikke lagrer noe nytt ved send-feil)
      await admin
        .from("employee_invites")
        .update({ token_hash: oldHash })
        .eq("id", inviteId)
        .eq("company_id", companyId);

      return jsonError(500, "email_send_failed", "Kunne ikke sende e-post. Ingenting ble lagret.", { rid, detail: String(mailErr?.message ?? mailErr) });
    }
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return jsonError(401, "not_authenticated", "Du må være innlogget.", { rid });
    if (code === "account_disabled") return jsonError(403, "account_disabled", "Kontoen er deaktivert.", { rid });
    if (code === "forbidden") return jsonError(403, "forbidden", "Ingen tilgang.", { rid });
    if (code === "missing_company") return jsonError(400, "missing_company", "Mangler company_id på admin-profilen.", { rid });
    if (code === "db_error") return jsonError(500, "db_error", "Databasefeil.", { rid, detail: e?.detail });
    return jsonError(500, "server_error", "Uventet feil.", { rid, detail: String(e?.message ?? e) });
  }
}
