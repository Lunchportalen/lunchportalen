// app/api/admin/employees/invites/bulk/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import nodemailer from "nodemailer";

import { buildEmployeeInviteUrl } from "@/lib/invites/employeeInviteUrl";
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

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function makeMailer() {
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

  return { transport, from };
}

async function authUserExists(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  if (error) throw error;
  return (data?.users ?? []).some((u) => normEmail(u.email) === normEmail(email));
}

function parseEmailLines(input: string): string[] {
  // Tillater: newline, komma, semikolon
  const raw = String(input ?? "")
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  // Unique (case-insens)
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

export async function POST(req: Request) {
  const rid = `inv_bulk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { user, companyId, actorEmail } = await requireCompanyAdmin();
    const body = await req.json().catch(() => ({}));

    const emailsText = String(body.emails ?? body.list ?? "").trim();
    const department = safeText(body.department, 80);
    const full_name = safeText(body.full_name ?? body.fullName, 120);
    const location_id = safeUUID(body.location_id ?? body.locationId);

    if (!emailsText) return jsonError(400, "missing_emails", "Mangler e-postliste.", { rid });

    const emails = parseEmailLines(emailsText);
    if (!emails.length) return jsonError(400, "no_valid_emails", "Fant ingen gyldige e-postadresser.", { rid });

    // Hard cap (sikkerhet)
    if (emails.length > 200) {
      return jsonError(400, "too_many", "Maks 200 e-poster per innsending. Del opp listen.", { rid, count: emails.length });
    }

    const admin = supabaseAdmin();

    // Lokasjon må tilhøre firma (hvis satt)
    if (location_id) {
      const loc = await admin.from("company_locations").select("id, company_id").eq("id", location_id).maybeSingle();
      if (loc.error) return jsonError(500, "location_check_failed", "Kunne ikke verifisere lokasjon.", { rid, detail: loc.error });
      if (!loc.data) return jsonError(400, "invalid_location", "Ugyldig lokasjon.", { rid });
      if (String(loc.data.company_id) !== String(companyId)) return jsonError(403, "location_forbidden", "Lokasjon tilhører ikke ditt firma.", { rid });
    }

    const { transport, from } = await makeMailer();
    const appUrl = mustEnv("PUBLIC_APP_URL").replace(/\/$/, "");

    // Resultatrapport
    const result: {
      email: string;
      status: "sent" | "invalid" | "exists" | "failed" | "skipped_active_invite";
      message?: string;
    }[] = [];

    // Prosesser sekvensielt (enkelt + trygg SMTP). Kan parallelliseres senere med kø.
    for (const email of emails) {
      if (!isEmail(email)) {
        result.push({ email, status: "invalid", message: "Ugyldig e-post." });
        continue;
      }

      // Hvis finnes i auth -> ikke send, ikke lagre
      const exists = await authUserExists(admin, email).catch((e) => {
        result.push({ email, status: "failed", message: "Kunne ikke verifisere auth." });
        return null;
      });
      if (exists === null) continue;
      if (exists) {
        result.push({ email, status: "exists", message: "Finnes allerede i systemet." });
        continue;
      }

      // Sjekk om det allerede finnes aktiv invite (used_at null). (index hindrer dobbelt)
      const active = await admin
        .from("employee_invites")
        .select("id")
        .eq("company_id", companyId)
        .eq("email", email)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (active.error) {
        result.push({ email, status: "failed", message: "Kunne ikke sjekke eksisterende invitasjon." });
        continue;
      }
      if (active.data?.id) {
        result.push({ email, status: "skipped_active_invite", message: "Aktiv invitasjon finnes allerede." });
        continue;
      }

      // Lag token
      const token = crypto.randomBytes(32).toString("hex");
      const token_hash = crypto.createHash("sha256").update(token).digest("hex");
      const link = buildEmployeeInviteUrl(appUrl, token);

      // SEND EPOST FØRST (kravet ditt)
      try {
        const subject = "Invitasjon til Lunchportalen";
        const text =
          `Du er invitert til Lunchportalen.\n\n` +
          `Åpne denne lenken for å akseptere invitasjonen og sette passord:\n${link}\n\n` +
          `Hvis du ikke forventet denne e-posten, kan du ignorere den.`;

        await transport.sendMail({ from, to: email, subject, text });
      } catch (e: any) {
        // Ved send-feil: lagres ingenting
        result.push({ email, status: "failed", message: `E-post kunne ikke sendes: ${String(e?.message ?? e)}` });
        continue;
      }

      // LAGRE INVITE ETTER SEND
      const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 dager
      const ins = await admin.from("employee_invites").insert({
        company_id: companyId,
        location_id: location_id ?? null,
        email,
        token_hash,
        department,
        full_name,
        created_by_user_id: user.id,
        created_by_email: actorEmail,
        expires_at,
        last_sent_at: new Date().toISOString(),
      });

      if (ins.error) {
        // NB: e-post er allerede sendt. Vi rapporterer tydelig.
        result.push({ email, status: "failed", message: "E-post sendt, men kunne ikke lagre invitasjon. Kontakt superadmin." });
        continue;
      }

      result.push({ email, status: "sent" });
    }

    const sent = result.filter((r) => r.status === "sent").length;
    const failed = result.filter((r) => r.status === "failed").length;
    const exists = result.filter((r) => r.status === "exists").length;
    const invalid = result.filter((r) => r.status === "invalid").length;
    const skipped = result.filter((r) => r.status === "skipped_active_invite").length;

    return jsonOk({
      ok: true,
      rid,
      summary: { total: emails.length, sent, failed, exists, invalid, skipped_active_invite: skipped },
      results: result,
    });
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
