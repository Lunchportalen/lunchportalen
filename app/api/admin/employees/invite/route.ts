// app/api/admin/employees/invite/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import nodemailer from "nodemailer";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

function makeRidLocal() {
  try {
    return crypto.randomUUID();
  } catch {
    return crypto.randomBytes(16).toString("hex");
  }
}

function normEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function safeText(v: unknown, max = 120) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
function isSystemEmail(email: string) {
  const e = normEmail(email);
  return e === "superadmin@lunchportalen.no" || e === "kjokken@lunchportalen.no" || e === "driver@lunchportalen.no";
}

function getAppUrl(req: NextRequest) {
  const env =
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (env) {
    const u = env.startsWith("http") ? env : `https://${env}`;
    return u.replace(/\/+$/, "");
  }

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  return "http://localhost:3000";
}

type SmtpCfgOk = { ok: true; host: string; port: number; user: string; pass: string; from: string; secure: boolean };
type SmtpCfgErr = { ok: false; error: string };
type SmtpCfg = SmtpCfgOk | SmtpCfgErr;

function smtpConfig(): SmtpCfg {
  const host = process.env.SMTP_HOST || process.env.LP_SMTP_HOST;
  const portRaw = process.env.SMTP_PORT || process.env.LP_SMTP_PORT;
  const user = process.env.SMTP_USER || process.env.LP_SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.LP_SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.LP_SMTP_FROM || user;

  if (!host) return { ok: false, error: "Missing env SMTP_HOST" };
  if (!portRaw) return { ok: false, error: "Missing env SMTP_PORT" };
  if (!user) return { ok: false, error: "Missing env SMTP_USER" };
  if (!pass) return { ok: false, error: "Missing env SMTP_PASS" };
  if (!from) return { ok: false, error: "Missing env SMTP_FROM" };

  const port = Number(portRaw);
  if (!Number.isFinite(port)) return { ok: false, error: "Invalid SMTP_PORT" };

  const secure = port === 465;
  return { ok: true, host: String(host), port, user: String(user), pass: String(pass), from: String(from), secure };
}

type SendOk = { ok: true };
type SendErr = { ok: false; error: string };
type SendRes = SendOk | SendErr;

async function sendInviteEmail(to: string, link: string): Promise<SendRes> {
  const cfg = smtpConfig();
  if (cfg.ok === false) return { ok: false, error: cfg.error };

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const subject = "Invitasjon til Lunchportalen";
  const text =
    `Du er invitert til Lunchportalen.\n\n` +
    `Åpne denne lenken for å akseptere invitasjonen og sette passord:\n${link}\n\n` +
    `Hvis du ikke forventet denne e-posten, kan du ignorere den.`;

  try {
    await transport.sendMail({ from: cfg.from, to, subject, text });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e ?? "Email send failed") };
  }
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function findActiveInvite(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, companyId: string, email: string) {
  const nowISO = new Date().toISOString();
  const { data, error } = await admin
    .from("employee_invites")
    .select("id, expires_at, used_at, last_sent_at")
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

async function cleanupExpiredUnused(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, companyId: string) {
  await admin
    .from("employee_invites")
    .delete()
    .eq("company_id", companyId)
    .is("used_at", null)
    .lt("expires_at", new Date().toISOString());
}

/**
 * ✅ LÅST: Finn firmaets default location (automatisk)
 * - Firma-admin velger aldri location
 * - Hvis firma mangler default -> stopp
 */
async function getDefaultLocationId(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, companyId: string) {
  const c = await admin.from("companies").select("id, default_location_id").eq("id", companyId).maybeSingle();
  if (c.error) return { ok: false as const, error: c.error };
  const defaultId = c.data?.default_location_id ? String(c.data.default_location_id) : "";

  if (!defaultId) {
    return { ok: true as const, locationId: null, reason: "missing_default_location" as const };
  }

  const loc = await admin.from("company_locations").select("id, company_id").eq("id", defaultId).maybeSingle();
  if (loc.error) return { ok: false as const, error: loc.error };
  if (!loc.data) return { ok: true as const, locationId: null, reason: "invalid_default_location" as const };
  if (String(loc.data.company_id) !== String(companyId)) {
    return { ok: true as const, locationId: null, reason: "default_location_mismatch" as const };
  }

  return { ok: true as const, locationId: defaultId };
}

export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.invite", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  const actorEmail = scope.email ?? null;
  const actorUserId = String(scope.userId ?? "").trim() || null;

  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler companyId i scope.");

  const body = await readJson(req);

  const email = normEmail((body as any)?.email);
  const department = safeText((body as any)?.department, 80);
  const full_name = safeText((body as any)?.full_name ?? (body as any)?.fullName ?? (body as any)?.name, 120);
  const forceResend = String((body as any)?.forceResend ?? "false").toLowerCase() === "true";

  if (!email || !isEmail(email)) return jsonErr(400, rid, "INVALID_EMAIL", "Ugyldig e-postadresse.");
  if (isSystemEmail(email)) return jsonErr(400, rid, "FORBIDDEN_EMAIL", "Denne e-posten kan ikke inviteres som ansatt.");

  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(500, rid, "CONFIG_ERROR", "Mangler service role konfigurasjon.", { message: String(e?.message ?? e) });
  }

  try {
    // default location (locked)
    const def = await getDefaultLocationId(admin, companyId);
    if (!def.ok) return jsonErr(500, rid, "DEFAULT_LOCATION_LOOKUP_FAILED", "Kunne ikke hente standard-lokasjon.", def.error);
    if (!def.locationId) {
      return jsonErr(409, rid, "MISSING_DEFAULT_LOCATION", "Firmaet mangler standard-lokasjon. Kontakt support/superadmin.", {
        companyId,
        reason: def.reason ?? "missing_default_location",
      });
    }
    const location_id = def.locationId;

    // Hard block: already onboarded (profiles.company_id != null)
    const prof = await admin.from("profiles").select("id, company_id, role, disabled_at").eq("email", email).maybeSingle();
    if (prof.error) return jsonErr(500, rid, "PROFILE_CHECK_FAILED", "Kunne ikke verifisere eksisterende profil.", prof.error);
    if (prof.data?.company_id) return jsonErr(409, rid, "ALREADY_ONBOARDED", "E-posten er allerede registrert som bruker i et firma.");

    await cleanupExpiredUnused(admin, companyId);

    const active = await findActiveInvite(admin, companyId, email);
    if (!active.ok) return jsonErr(500, rid, "INVITE_CHECK_FAILED", "Kunne ikke sjekke eksisterende invitasjon.", active.error);

    if (active.invite?.id && !forceResend) {
      return jsonOk({
        ok: true,
        rid,
        message: "Aktiv invitasjon finnes allerede.",
        alreadyActive: true,
        inviteId: String(active.invite.id),
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const token_hash = sha256Hex(rawToken);
    const appUrl = getAppUrl(req);
    const link = `${appUrl}/accept-invite?token=${encodeURIComponent(rawToken)}`;

    // SEND FIRST (samme flyt som original)
    const sent = await sendInviteEmail(email, link);
    if (sent.ok === false) {
      return jsonErr(500, rid, "EMAIL_SEND_FAILED", "Kunne ikke sende invitasjon på e-post.", { message: sent.error });
    }

    const nowIso = new Date().toISOString();
    const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    if (active.invite?.id) {
      const upd = await admin
        .from("employee_invites")
        .update({
          token_hash,
          expires_at,
          last_sent_at: nowIso,
          department: department ?? null,
          full_name: full_name ?? null,
          location_id,
        })
        .eq("id", active.invite.id)
        .eq("company_id", companyId)
        .is("used_at", null);

      if (upd.error) return jsonErr(500, rid, "INVITE_UPDATE_FAILED", "E-post sendt, men kunne ikke oppdatere invitasjon.", upd.error);

      return jsonOk({ ok: true, rid, message: "Invitasjon sendt på nytt.", resent: true, inviteId: String(active.invite.id) });
    }

    const ins = await admin.from("employee_invites").insert({
      company_id: companyId,
      location_id,
      email,
      token_hash,
      department,
      full_name,
      created_by_user_id: actorUserId,
      created_by_email: actorEmail,
      expires_at,
      last_sent_at: nowIso,
    });

    if (ins.error) return jsonErr(500, rid, "INVITE_STORE_FAILED", "E-post sendt, men kunne ikke lagre invitasjon.", ins.error);

    return jsonOk({ ok: true, rid, message: "Invitasjon sendt." });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}

export async function GET() {
  const rid = makeRidLocal();
  return jsonErr(405, rid, "METHOD_NOT_ALLOWED", "Bruk POST for å invitere ansatte.");
}


