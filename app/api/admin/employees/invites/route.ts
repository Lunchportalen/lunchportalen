// app/api/admin/employees/invite/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import nodemailer from "nodemailer";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

const allowedRoles = ["company_admin", "superadmin"] as const;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}
function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function getEnv(name: string): string | null {
  const v = process.env[name];
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.invite.smtp", [...allowedRoles]);
  if (denyRole) return denyRole;

  // company_admin må ha company scope; superadmin kan være uten scope
  if (scope.role === "company_admin") {
    const denyScope = requireCompanyScopeOr403(a.ctx);
    if (denyScope) return denyScope;
  }

  const body = (await readJson(req)) as { email?: string; name?: string; message?: string };
  const email = normEmail(body?.email);
  const name = safeStr(body?.name);
  const message = safeStr(body?.message);

  if (!email || !isEmail(email)) {
    return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig e-postadresse.", { field: "email" });
  }

  // Env (ingen throw)
  const host = getEnv("SMTP_HOST");
  const portRaw = getEnv("SMTP_PORT");
  const user = getEnv("SMTP_USER");
  const pass = getEnv("SMTP_PASS");
  const from = getEnv("SMTP_FROM") || user;

  if (!host || !portRaw || !user || !pass || !from) {
    return jsonErr(500, rid, "CONFIG_ERROR", "Mangler SMTP-konfigurasjon (env).", {
      missing: [
        !host ? "SMTP_HOST" : null,
        !portRaw ? "SMTP_PORT" : null,
        !user ? "SMTP_USER" : null,
        !pass ? "SMTP_PASS" : null,
        !from ? "SMTP_FROM" : null,
      ].filter(Boolean),
    });
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    return jsonErr(500, rid, "CONFIG_ERROR", "Ugyldig SMTP_PORT.", { value: portRaw });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const displayName = name ? ` (${name})` : "";
    const subject = `Lunchportalen – Invitasjon${displayName}`;
    const text =
      message ||
      `Hei!\n\nDu er invitert til Lunchportalen.\n\nLogg inn via /login.\n\nVennlig hilsen\nLunchportalen`;

    await transporter.sendMail({ from, to: email, subject, text });

    return jsonOk({ ok: true, rid });
  } catch (err: unknown) {
    const detail = err instanceof Error ? { name: err.name, message: err.message } : { err };
    return jsonErr(502, rid, "SMTP_ERROR", "Kunne ikke sende invitasjon på e-post.", detail);
  }
}
