// app/api/admin/employees/invite/route.ts
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

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function safeText(v: any, max = 120) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
function isSystemEmail(email: string) {
  const e = normEmail(email);
  return e === "superadmin@lunchportalen.no" || e === "kjokken@lunchportalen.no" || e === "driver@lunchportalen.no";
}

async function requireCompanyAdmin() {
  const sb = await supabaseServer();
  const { data: auth, error: uerr } = await sb.auth.getUser();
  const user = auth?.user ?? null;
  if (uerr || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });

  const { data: profile, error: perr } = await sb
    .from("profiles")
    .select("user_id, company_id, role, email, disabled_at")
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

  return { user, companyId, actorEmail: user.email ?? profile?.email ?? null };
}

function getAppUrl(req: Request) {
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

async function findActiveInvite(admin: ReturnType<typeof supabaseAdmin>, companyId: string, email: string) {
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

async function cleanupExpiredUnused(admin: ReturnType<typeof supabaseAdmin>, companyId: string) {
  await admin
    .from("employee_invites")
    .delete()
    .eq("company_id", companyId)
    .is("used_at", null)
    .lt("expires_at", new Date().toISOString());
}

function smtpConfig() {
  const host = process.env.SMTP_HOST || process.env.LP_SMTP_HOST;
  const portRaw = process.env.SMTP_PORT || process.env.LP_SMTP_PORT;
  const user = process.env.SMTP_USER || process.env.LP_SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.LP_SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.LP_SMTP_FROM || user;

  if (!host) throw new Error("Missing env SMTP_HOST");
  if (!portRaw) throw new Error("Missing env SMTP_PORT");
  if (!user) throw new Error("Missing env SMTP_USER");
  if (!pass) throw new Error("Missing env SMTP_PASS");
  if (!from) throw new Error("Missing env SMTP_FROM");

  const port = Number(portRaw);
  if (!Number.isFinite(port)) throw new Error("Invalid SMTP_PORT");

  const secure = port === 465;
  return { host, port, user, pass, from, secure };
}

async function sendInviteEmail(to: string, link: string) {
  const { host, port, user, pass, from, secure } = smtpConfig();

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const subject = "Invitasjon til Lunchportalen";
  const text =
    `Du er invitert til Lunchportalen.\n\n` +
    `Åpne denne lenken for å akseptere invitasjonen og sette passord:\n${link}\n\n` +
    `Hvis du ikke forventet denne e-posten, kan du ignorere den.`;

  await transport.sendMail({ from, to, subject, text });
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * ✅ LÅST: Finn firmaets default location (automatisk)
 * - Firma-admin velger aldri location
 * - Hvis firma mangler default -> stopp
 */
async function getDefaultLocationId(admin: ReturnType<typeof supabaseAdmin>, companyId: string) {
  // 1) company.default_location_id
  const c = await admin.from("companies").select("id, default_location_id").eq("id", companyId).maybeSingle();
  if (c.error) return { ok: false as const, error: c.error };
  const defaultId = c.data?.default_location_id ? String(c.data.default_location_id) : "";

  if (!defaultId) {
    return {
      ok: true as const,
      locationId: null,
      reason: "missing_default_location" as const,
    };
  }

  // 2) validate location belongs to company
  const loc = await admin.from("company_locations").select("id, company_id").eq("id", defaultId).maybeSingle();
  if (loc.error) return { ok: false as const, error: loc.error };
  if (!loc.data) return { ok: true as const, locationId: null, reason: "invalid_default_location" as const };
  if (String(loc.data.company_id) !== String(companyId)) {
    return { ok: true as const, locationId: null, reason: "default_location_mismatch" as const };
  }

  return { ok: true as const, locationId: defaultId };
}

export async function POST(req: Request) {
  const rid = `emp_inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { user, companyId, actorEmail } = await requireCompanyAdmin();
    const body = await req.json().catch(() => ({}));

    const email = normEmail(body.email);
    const department = safeText(body.department, 80);
    const full_name = safeText(body.full_name ?? body.fullName ?? body.name, 120);

    // ✅ LÅST: ignore location entirely (admin skal ikke velge)
    // const location_id = ... (fjernet)

    const forceResend = String(body.forceResend ?? "false").toLowerCase() === "true";

    if (!email || !isEmail(email)) return jsonError(400, "invalid_email", "Ugyldig e-postadresse.", { rid });
    if (isSystemEmail(email)) return jsonError(400, "forbidden_email", "Denne e-posten kan ikke inviteres som ansatt.", { rid });

    const admin = supabaseAdmin();

    // ✅ LÅST: Hent default-lokasjon automatisk
    const def = await getDefaultLocationId(admin, companyId);
    if (!def.ok) {
      return jsonError(500, "default_location_lookup_failed", "Kunne ikke hente standard-lokasjon.", { rid, detail: def.error });
    }
    if (!def.locationId) {
      return jsonError(
        409,
        "missing_default_location",
        "Firmaet mangler standard-lokasjon. Kontakt support/superadmin.",
        { rid, companyId, reason: def.reason ?? "missing_default_location" }
      );
    }
    const location_id = def.locationId;

    // ✅ FASIT: Bruk "profiles.company_id != null" som eneste "er i systemet"-sperre.
    const prof = await admin
      .from("profiles")
      .select("user_id, company_id, role, is_active, disabled_at")
      .eq("email", email)
      .maybeSingle();

    if (prof.error) {
      return jsonError(500, "profile_check_failed", "Kunne ikke verifisere eksisterende profil.", { rid, detail: prof.error });
    }

    if (prof.data?.company_id) {
      return jsonError(409, "already_onboarded", "E-posten er allerede registrert som bruker i et firma.", { rid });
    }

    await cleanupExpiredUnused(admin, companyId);

    const active = await findActiveInvite(admin, companyId, email);
    if (!active.ok) {
      return jsonError(500, "invite_check_failed", "Kunne ikke sjekke eksisterende invitasjon.", { rid, detail: active.error });
    }

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

    // 1) SEND E-POST FØRST
    await sendInviteEmail(email, link);

    const nowIso = new Date().toISOString();
    const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    if (active.invite?.id) {
      // RESEND: oppdater invite men IKKE la admin endre location
      const upd = await admin
        .from("employee_invites")
        .update({
          token_hash,
          expires_at,
          last_sent_at: nowIso,
          department: department ?? null,
          full_name: full_name ?? null,
          location_id, // ✅ låst til default (kan oppdateres til default hvis tidligere var null)
        })
        .eq("id", active.invite.id);

      if (upd.error) {
        return jsonError(500, "invite_update_failed", "E-post sendt, men kunne ikke oppdatere invitasjon.", { rid, detail: upd.error });
      }

      return jsonOk({
        ok: true,
        rid,
        message: "Invitasjon sendt på nytt.",
        resent: true,
        inviteId: String(active.invite.id),
      });
    }

    // 2) LAGRE invite (NY) med låst location
    const ins = await admin.from("employee_invites").insert({
      company_id: companyId,
      location_id, // ✅ alltid satt og låst
      email,
      token_hash,
      department,
      full_name,
      created_by_user_id: user.id,
      created_by_email: actorEmail,
      expires_at,
      last_sent_at: nowIso,
    });

    if (ins.error) {
      return jsonError(500, "invite_store_failed", "E-post sendt, men kunne ikke lagre invitasjon.", { rid, detail: ins.error });
    }

    return jsonOk({ ok: true, rid, message: "Invitasjon sendt." });
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

export async function GET() {
  return jsonError(405, "method_not_allowed", "Bruk POST for å invitere ansatte.");
}
