// app/api/admin/invites/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import nodemailer from "nodemailer";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";
import { isSystemEmail as isSystemEmailCore } from "@/lib/system/emails";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function safeText(v: unknown, max = 120) {
  const s = safeStr(v);
  return s ? s.slice(0, max) : null;
}

function safeUUID(v: unknown) {
  const s = safeStr(v);
  if (!s) return null;
  const ok =
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(s);
  return ok ? s : null;
}

function isSystemEmail(email: string) {
  return isSystemEmailCore(email);
}

function parseEmailLines(input: string): string[] {
  const raw = String(input ?? "")
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of raw) {
    const n = normEmail(e);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function getPublicAppUrl(req: NextRequest): string {
  const env =
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  const s = safeStr(env);
  if (s) {
    const u = s.startsWith("http") ? s : `https://${s}`;
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
    `Åpne denne lenken for å akseptere invitasjonen og sette passord:\n${opts.link}\n\n` +
    `Hvis du ikke forventet denne e-posten, kan du ignorere den.`;

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

async function resolveInviteLocation(
  admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>,
  companyId: string,
  locationOverride: string | null
) {
  const c = await admin
    .from("companies")
    .select("id,name,default_location_id")
    .eq("id", companyId)
    .maybeSingle();

  if (c.error) return { ok: false as const, error: c.error };

  const companyName = safeStr(c.data?.name) || "Firma";

  if (locationOverride) {
    const loc = await admin.from("company_locations").select("id,company_id").eq("id", locationOverride).maybeSingle();
    if (loc.error) return { ok: false as const, error: loc.error };
    if (!loc.data) {
      return { ok: true as const, locationId: null, companyName, reason: "invalid_location" as const };
    }
    if (safeStr(loc.data.company_id) !== companyId) {
      return { ok: true as const, locationId: null, companyName, reason: "location_mismatch" as const };
    }
    return { ok: true as const, locationId: locationOverride, companyName };
  }

  const defaultId = safeStr(c.data?.default_location_id);
  if (!defaultId) {
    return { ok: true as const, locationId: null, companyName, reason: "missing_default_location" as const };
  }

  const loc = await admin.from("company_locations").select("id,company_id").eq("id", defaultId).maybeSingle();
  if (loc.error) return { ok: false as const, error: loc.error };
  if (!loc.data) return { ok: true as const, locationId: null, companyName, reason: "invalid_default_location" as const };
  if (safeStr(loc.data.company_id) !== companyId) {
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
    .select("id,expires_at,used_at,last_sent_at")
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

function normalizeInvites(body: any): Array<{ email: string; full_name: string | null; department: string | null }> {
  if (Array.isArray(body?.invites)) {
    return body.invites.map((r: any) => ({
      email: normEmail(r?.email),
      full_name: safeText(r?.full_name ?? r?.fullName ?? r?.name, 120),
      department: safeText(r?.department, 80),
    }));
  }

  const emailsRaw = safeStr(body?.emails || body?.list || "");
  if (emailsRaw) {
    const emails = parseEmailLines(emailsRaw);
    const dept = safeText(body?.department, 80);
    return emails.map((email) => ({ email, full_name: null, department: dept }));
  }

  if (body?.email) {
    return [
      {
        email: normEmail(body.email),
        full_name: safeText(body?.full_name ?? body?.fullName ?? body?.name, 120),
        department: safeText(body?.department, 80),
      },
    ];
  }

  return [];
}

export async function GET(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.invites.list", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  try {
    const url = new URL(req.url);
    const q = safeStr(url.searchParams.get("q")).toLowerCase();
    const includeExpired = safeStr(url.searchParams.get("includeExpired")).toLowerCase() === "true";
    const includeUsed = safeStr(url.searchParams.get("includeUsed")).toLowerCase() === "true";
    const limitRaw = safeStr(url.searchParams.get("limit"));
    const limit = Math.min(Math.max(Number(limitRaw || 200), 50), 500);
    const nowIso = new Date().toISOString();

    const admin = supabaseAdmin();
    let query = admin
      .from("employee_invites")
      .select("id,email,full_name,department,location_id,created_at,last_sent_at,expires_at,used_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!includeUsed) query = query.is("used_at", null);
    if (!includeExpired) query = query.gt("expires_at", nowIso);
    if (q) {
      query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,department.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) return jsonErr(rid, "Kunne ikke hente invitasjoner.", 500, { code: "DB_ERROR", detail: { message: error.message } });

    return jsonOk(a.ctx.rid, { invites: data ?? [] });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}

export async function POST(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.invites.create", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  const actorUserId = safeStr(scope.userId) || null;
  const actorEmail = scope.email ?? null;

  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const body = await readJson(req);
  const invites = normalizeInvites(body);
  if (!invites.length) return jsonErr(rid, "Mangler invitasjoner.", 400, "MISSING_INVITES");

  const locationOverride = safeUUID(body?.location_id ?? body?.locationId) || null;

  const admin = supabaseAdmin();

  try {
    const locationRes = await resolveInviteLocation(admin, companyId, locationOverride);
    if (!locationRes.ok) {
      return jsonErr(rid, "Kunne ikke hente lokasjon.", 500, { code: "LOCATION_LOOKUP_FAILED", detail: locationRes.error });
    }
    if (!locationRes.locationId) {
      return jsonErr(rid, "Firmaet mangler gyldig standard-lokasjon.", 409, { code: "MISSING_LOCATION", detail: {
        reason: locationRes.reason ?? "missing_default_location",
      } });
    }

    const appUrl = getPublicAppUrl(req);
    const results: Array<{
      email: string;
      status: "created" | "already_exists" | "already_invited" | "invalid" | "failed";
      message?: string;
      inviteId?: string | null;
    }> = [];
    const seen = new Set<string>();

    for (const item of invites) {
      const email = normEmail(item.email);
      const full_name = safeText(item.full_name, 120);
      const department = safeText(item.department, 80);

      if (!email || !isEmail(email)) {
        results.push({ email: email || "", status: "invalid", message: "Ugyldig e-postadresse." });
        continue;
      }
      if (seen.has(email)) {
        results.push({ email, status: "invalid", message: "Duplikat i listen." });
        continue;
      }
      seen.add(email);
      if (isSystemEmail(email)) {
        results.push({ email, status: "invalid", message: "Denne e-posten kan ikke inviteres som ansatt." });
        continue;
      }

      const existingProfile = await admin
        .from("profiles")
        .select("id,company_id")
        .eq("email", email)
        .not("company_id", "is", null)
        .maybeSingle();

      if (existingProfile.error) {
        results.push({ email, status: "failed", message: "Kunne ikke sjekke eksisterende profil." });
        continue;
      }
      if (existingProfile.data?.company_id) {
        results.push({ email, status: "already_exists", message: "E-posten er allerede registrert i et firma." });
        continue;
      }

      const active = await findActiveInvite(admin, companyId, email);
      if (!active.ok) {
        results.push({ email, status: "failed", message: "Kunne ikke sjekke eksisterende invitasjon." });
        continue;
      }
      if (active.invite?.id) {
        results.push({
          email,
          status: "already_invited",
          message: "Aktiv invitasjon finnes allerede.",
          inviteId: String(active.invite.id),
        });
        continue;
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const token_hash = sha256Hex(rawToken);
      const link = `${appUrl}/accept-invite?token=${encodeURIComponent(rawToken)}`;

      const sent = await sendInviteEmail({ to: email, link, companyName: locationRes.companyName });
      if (sent.ok === false) {
        results.push({ email, status: "failed", message: "Kunne ikke sende invitasjon på e-post." });
        continue;
      }

      const nowIso = new Date().toISOString();
      const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

      const ins = await admin
        .from("employee_invites")
        .insert({
          company_id: companyId,
          location_id: locationRes.locationId,
          email,
          token_hash,
          department,
          full_name,
          created_by_user_id: actorUserId,
          created_by_email: actorEmail,
          expires_at,
          last_sent_at: nowIso,
        })
        .select("id")
        .maybeSingle();

      if (ins.error) {
        results.push({ email, status: "failed", message: "E-post sendt, men kunne ikke lagre invitasjon." });
        continue;
      }

      results.push({ email, status: "created", inviteId: ins.data?.id ? String(ins.data.id) : null });
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      already_exists: results.filter((r) => r.status === "already_exists").length,
      already_invited: results.filter((r) => r.status === "already_invited").length,
      invalid: results.filter((r) => r.status === "invalid").length,
      failed: results.filter((r) => r.status === "failed").length,
    };

    return jsonOk(a.ctx.rid, { summary, results });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}

