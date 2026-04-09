import "server-only";

import crypto from "node:crypto";
import nodemailer from "nodemailer";

import { auditAdmin } from "@/lib/audit/actions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isSystemEmail as isSystemEmailCore, SYSTEM_EMAILS } from "@/lib/system/emails";

import { buildEmployeeInviteUrl, getPublicAppUrlFromEnv } from "@/lib/invites/employeeInviteUrl";

export const EMPLOYEE_INVITE_TTL_MS = 1000 * 60 * 60 * 48;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export function normInviteEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}

export function isInviteEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function smtpConfig() {
  const host = process.env.SMTP_HOST || process.env.LP_SMTP_HOST;
  const portRaw = process.env.SMTP_PORT || process.env.LP_SMTP_PORT;
  const user = process.env.SMTP_USER || process.env.LP_SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.LP_SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.LP_SMTP_FROM || user;

  if (!host || !portRaw || !user || !pass || !from) return { ok: false as const, error: "smtp_not_configured" };
  const port = Number(portRaw);
  if (!Number.isFinite(port)) return { ok: false as const, error: "smtp_bad_port" };
  return {
    ok: true as const,
    host: String(host),
    port,
    user: String(user),
    pass: String(pass),
    from: String(from),
    secure: port === 465,
  };
}

async function sendInviteEmailBestEffort(opts: { to: string; link: string; companyName: string }) {
  const cfg = smtpConfig();
  if (cfg.ok === false) return { ok: false as const, error: cfg.error };

  try {
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });

    const subject = "Invitasjon til Lunchportalen";
    const text =
      `Du er invitert til Lunchportalen av ${opts.companyName}.\n\n` +
      `Åpne lenken for å opprette konto (ansatt):\n${opts.link}\n\n` +
      `Hvis du ikke forventet denne e-posten, kan du ignorere den.\n\n` +
      `Spørsmål? Kontakt ${SYSTEM_EMAILS.ORDER}.`;

    await transport.sendMail({ from: cfg.from, to: opts.to, subject, text });
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message ?? e ?? "email_failed") };
  }
}

async function getDefaultLocationId(admin: ReturnType<typeof supabaseAdmin>, companyId: string) {
  const c = await admin.from("companies").select("id, default_location_id, name").eq("id", companyId).maybeSingle();
  if (c.error) return { ok: false as const, error: c.error };
  const defaultId = c.data?.default_location_id ? String(c.data.default_location_id) : "";
  const companyName = String(c.data?.name ?? "Firma").trim() || "Firma";

  if (!defaultId) {
    return { ok: true as const, locationId: null, companyName, reason: "missing_default_location" as const };
  }

  const loc = await admin.from("company_locations").select("id, company_id").eq("id", defaultId).maybeSingle();
  if (loc.error) return { ok: false as const, error: loc.error };
  if (!loc.data) return { ok: true as const, locationId: null, companyName, reason: "invalid_default_location" as const };
  if (String(loc.data.company_id) !== String(companyId)) {
    return { ok: true as const, locationId: null, companyName, reason: "default_location_mismatch" as const };
  }

  return { ok: true as const, locationId: defaultId, companyName };
}

async function findActiveInvite(admin: ReturnType<typeof supabaseAdmin>, companyId: string, email: string) {
  const nowISO = new Date().toISOString();
  const { data, error } = await admin
    .from("employee_invites")
    .select("id, expires_at, used_at")
    .eq("company_id", companyId)
    .eq("email", email)
    .is("used_at", null)
    .gt("expires_at", nowISO)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false as const, error };
  return { ok: true as const, invite: data ?? null };
}

export type CreateEmployeeSingleInviteResult =
  | { ok: true; inviteUrl: string; inviteId: string | null; emailSent: boolean; emailError?: string }
  | {
      ok: false;
      code:
        | "BAD_EMAIL"
        | "SYSTEM_EMAIL"
        | "MISSING_DEFAULT_LOCATION"
        | "ALREADY_IN_COMPANY"
        | "ALREADY_INVITED"
        | "INSERT_FAILED"
        | "PROFILE_LOOKUP_FAILED"
        | "INVITE_CHECK_FAILED";
      message: string;
    };

export async function createEmployeeSingleInvite(opts: {
  companyId: string;
  actorUserId: string;
  actorEmail: string | null;
  actorLocationId: string | null;
  emailRaw: string;
  appBaseUrl?: string;
}): Promise<CreateEmployeeSingleInviteResult> {
  const email = normInviteEmail(opts.emailRaw);
  if (!email || !isInviteEmail(email)) {
    return { ok: false, code: "BAD_EMAIL", message: "Ugyldig e-postadresse." };
  }
  if (isSystemEmailCore(email)) {
    return { ok: false, code: "SYSTEM_EMAIL", message: "Denne e-posten kan ikke inviteres som ansatt." };
  }

  const admin = supabaseAdmin();
  const companyId = safeStr(opts.companyId);
  if (!companyId) {
    return { ok: false, code: "INSERT_FAILED", message: "Mangler firma." };
  }

  const prof = await admin.from("profiles").select("id, company_id").eq("email", email).maybeSingle();
  if (prof.error) {
    return { ok: false, code: "PROFILE_LOOKUP_FAILED", message: "Kunne ikke verifisere eksisterende profil." };
  }
  if (prof.data?.company_id) {
    return { ok: false, code: "ALREADY_IN_COMPANY", message: "E-posten er allerede registrert i et firma." };
  }

  const active = await findActiveInvite(admin, companyId, email);
  if (!active.ok) {
    return { ok: false, code: "INVITE_CHECK_FAILED", message: "Kunne ikke sjekke eksisterende invitasjon." };
  }
  if (active.invite?.id) {
    return { ok: false, code: "ALREADY_INVITED", message: "Aktiv invitasjon finnes allerede for denne e-posten." };
  }

  const def = await getDefaultLocationId(admin, companyId);
  if (!def.ok) {
    return { ok: false, code: "INSERT_FAILED", message: "Kunne ikke hente standard-lokasjon." };
  }
  if (!def.locationId) {
    return {
      ok: false,
      code: "MISSING_DEFAULT_LOCATION",
      message: "Firmaet mangler standard-lokasjon. Kontakt support/superadmin.",
    };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const token_hash = sha256Hex(rawToken);
  const expires_at = new Date(Date.now() + EMPLOYEE_INVITE_TTL_MS).toISOString();
  const nowIso = new Date().toISOString();
  const appUrl = safeStr(opts.appBaseUrl) || getPublicAppUrlFromEnv();
  const inviteUrl = buildEmployeeInviteUrl(appUrl, rawToken);

  const ins = await admin
    .from("employee_invites")
    .insert({
      company_id: companyId,
      location_id: def.locationId,
      email,
      role: "employee",
      token_hash,
      department: null,
      full_name: null,
      created_by_user_id: safeStr(opts.actorUserId) || null,
      created_by_email: opts.actorEmail,
      expires_at,
      last_sent_at: nowIso,
    })
    .select("id")
    .maybeSingle();

  if (ins.error) {
    const msg = String(ins.error.message ?? "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, code: "ALREADY_INVITED", message: "Aktiv invitasjon finnes allerede for denne e-posten." };
    }
    return { ok: false, code: "INSERT_FAILED", message: "Kunne ikke lagre invitasjon." };
  }

  const sent = await sendInviteEmailBestEffort({ to: email, link: inviteUrl, companyName: def.companyName });

  await auditAdmin({
    actor_user_id: safeStr(opts.actorUserId),
    actor_email: opts.actorEmail,
    action: "admin.invite.employee_single",
    company_id: companyId,
    location_id: opts.actorLocationId,
    target_type: "employee_invite",
    target_id: ins.data?.id ? String(ins.data.id) : null,
    target_label: email,
    meta: {
      expires_at,
      email_sent: sent.ok === true,
      email_error: sent.ok === false ? sent.error : null,
      invite_url_path: "/register/employee",
    },
  });

  return {
    ok: true,
    inviteUrl,
    inviteId: ins.data?.id ? String(ins.data.id) : null,
    emailSent: sent.ok === true,
    emailError: sent.ok === false ? sent.error : undefined,
  };
}
