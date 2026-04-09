// app/api/admin/invite/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import nodemailer from "nodemailer";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";
import { auditAdmin } from "@/lib/audit/actions";
import { buildEmployeeInviteUrl } from "@/lib/invites/employeeInviteUrl";
import { isSystemEmail as isSystemEmailCore, SYSTEM_EMAILS } from "@/lib/system/emails";

type InviteInput = {
  full_name?: string | null;
  email?: string | null;
  department?: string | null;
};

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
  return isSystemEmailCore(email);
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

async function sendInviteEmail(opts: { to: string; link: string; companyName: string }) {
  const cfg = smtpConfig();
  if (cfg.ok === false) return { ok: false as const, error: cfg.error };

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const subject = "Invitasjon til Lunchportalen";
  const text =
    `Du er invitert til Lunchportalen av ${opts.companyName}.\n\n` +
    `Dette gir tilgang til firmalunsj (bestilling/avbestilling) innenfor avtalen.\n\n` +
    `Åpne lenken for å akseptere invitasjonen og sette passord:\n${opts.link}\n\n` +
    `Spørsmål? Kontakt ${SYSTEM_EMAILS.ORDER}.`;

  try {
    await transport.sendMail({ from: cfg.from, to: opts.to, subject, text });
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message ?? e ?? "Email send failed") };
  }
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function getDefaultLocationId(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, companyId: string) {
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

async function findActiveInvite(
  admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>,
  companyId: string,
  email: string
) {
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

function normalizeInvites(body: any): InviteInput[] {
  if (Array.isArray(body?.invites)) return body.invites as InviteInput[];
  if (body?.email || body?.full_name || body?.fullName || body?.department) {
    return [
      {
        full_name: body?.full_name ?? body?.fullName ?? body?.name ?? null,
        email: body?.email ?? null,
        department: body?.department ?? null,
      },
    ];
  }
  return [];
}

export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.invite", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  const actorUserId = String(scope.userId ?? "").trim();
  const actorEmail = scope.email ?? null;
  const locationId = scope.locationId ?? null;

  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const body = await readJson(req);
  const rawInvites = normalizeInvites(body);
  if (!rawInvites.length) return jsonErr(rid, "Mangler invitasjoner.", 400, "MISSING_INVITES");

  const emailsSeen = new Set<string>();
  const errors: { email?: string | null; message: string }[] = [];
  const invites: Array<{ email: string; full_name: string | null; department: string | null }> = [];

  for (const r of rawInvites) {
    const email = normEmail(r?.email);
    const full_name = safeText(r?.full_name, 120);
    const department = safeText(r?.department, 80);

    if (!email || !isEmail(email)) {
      errors.push({ email: email || null, message: "Ugyldig e-postadresse." });
      continue;
    }
    if (isSystemEmail(email)) {
      errors.push({ email, message: "Denne e-posten kan ikke inviteres som ansatt." });
      continue;
    }
    if (emailsSeen.has(email)) {
      errors.push({ email, message: "Duplikat i listen." });
      continue;
    }

    emailsSeen.add(email);
    invites.push({ email, full_name, department });
  }

  if (errors.length) {
    return jsonErr(rid, "Invitasjonslisten inneholder feil.", 400, { code: "INVALID_INVITES", detail: { errors } });
  }

  const admin = supabaseAdmin();

  try {
    const def = await getDefaultLocationId(admin, companyId);
    if (!def.ok) return jsonErr(rid, "Kunne ikke hente standard-lokasjon.", 500, { code: "DEFAULT_LOCATION_LOOKUP_FAILED", detail: def.error });
    if (!def.locationId) {
      return jsonErr(rid, "Firmaet mangler standard-lokasjon. Kontakt support/superadmin.", 409, { code: "MISSING_DEFAULT_LOCATION", detail: {
        companyId,
        reason: def.reason ?? "missing_default_location",
      } });
    }

    const appUrl = getAppUrl(req);
    const results: Array<{
      email: string;
      status: "created" | "already_exists" | "already_invited" | "failed";
      message?: string;
      inviteId?: string | null;
      inviteUrl?: string | null;
    }> = [];

    for (const i of invites) {
      // already onboarded
      const prof = await admin.from("profiles").select("id, company_id").eq("email", i.email).maybeSingle();
      if (prof.error) {
        results.push({ email: i.email, status: "failed", message: "Kunne ikke verifisere eksisterende profil." });
        continue;
      }
      if (prof.data?.company_id) {
        results.push({ email: i.email, status: "already_exists", message: "E-posten er allerede registrert i et firma." });
        continue;
      }

      const active = await findActiveInvite(admin, companyId, i.email);
      if (!active.ok) {
        results.push({ email: i.email, status: "failed", message: "Kunne ikke sjekke eksisterende invitasjon." });
        continue;
      }
      if (active.invite?.id) {
        results.push({
          email: i.email,
          status: "already_invited",
          message: "Aktiv invitasjon finnes allerede.",
          inviteId: String(active.invite.id),
        });
        continue;
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const token_hash = sha256Hex(rawToken);
      const link = buildEmployeeInviteUrl(appUrl, rawToken);

      const sent = await sendInviteEmail({ to: i.email, link, companyName: def.companyName });
      if (sent.ok === false) {
        results.push({ email: i.email, status: "failed", message: "Kunne ikke sende invitasjon på e-post." });
        continue;
      }

      const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
      const nowIso = new Date().toISOString();

      const ins = await admin.from("employee_invites").insert({
        company_id: companyId,
        location_id: def.locationId,
        email: i.email,
        token_hash,
        department: i.department ?? null,
        full_name: i.full_name ?? null,
        created_by_user_id: actorUserId || null,
        created_by_email: actorEmail,
        expires_at,
        last_sent_at: nowIso,
      }).select("id").maybeSingle();

      if (ins.error) {
        results.push({ email: i.email, status: "failed", message: "E-post sendt, men kunne ikke lagre invitasjon." });
        continue;
      }

      results.push({
        email: i.email,
        status: "created",
        inviteId: ins.data?.id ? String(ins.data.id) : null,
        inviteUrl: link,
      });
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      already_exists: results.filter((r) => r.status === "already_exists").length,
      already_invited: results.filter((r) => r.status === "already_invited").length,
      failed: results.filter((r) => r.status === "failed").length,
    };

    await auditAdmin({
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action: "admin.invite.bulk",
      company_id: companyId,
      location_id: locationId,
      meta: {
        rid,
        count: results.length,
        summary,
        results,
      },
    });

    return jsonOk(rid, { summary, results }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}

export async function GET() {
  return jsonErr("invite_method_not_allowed", "Bruk POST for å invitere ansatte.", 405, "METHOD_NOT_ALLOWED");
}
