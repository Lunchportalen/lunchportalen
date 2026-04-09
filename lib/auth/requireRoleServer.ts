// STATUS: KEEP

import "server-only";

import { redirect } from "next/navigation";
import { getScopeServer } from "@/lib/auth/getScopeServer";
import { ScopeError } from "@/lib/auth/scope";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function statusUrl(state: string, code?: string) {
  return `/status?state=${encodeURIComponent(state)}${code ? `&code=${encodeURIComponent(code)}` : ""}`;
}

export async function requireRoleServer(allowed: Role[]) {
  try {
    const { scope } = await getScopeServer();

    const role = safeStr(scope?.role) as Role;

    if (!role || !allowed.includes(role)) {
      redirect(statusUrl("blocked", "ROLE_FORBIDDEN"));
    }

    // Company status guard (fail-closed)
    if (role !== "superadmin") {
      if (!scope?.is_active) {
        redirect(statusUrl("pending", "COMPANY_NOT_ACTIVE"));
      }

      const ag = safeStr(scope?.agreement_status).toLowerCase();

      if (ag === "paused") redirect(statusUrl("paused", "AGREEMENT_PAUSED"));
      if (ag === "closed") redirect(statusUrl("closed", "AGREEMENT_CLOSED"));
      if (!ag || ag === "unknown") redirect(statusUrl("blocked", "SCOPE_UNKNOWN"));
      if (ag !== "active") redirect(statusUrl("blocked", "AGREEMENT_NOT_ACTIVE"));
    }

    return scope;
  } catch (e: any) {
    if (e instanceof ScopeError) {
      if (e.code === "UNAUTHENTICATED") {
        redirect("/login?code=NO_SESSION");
      }
      redirect(statusUrl("blocked", e.code || "SCOPE_ERROR"));
    }

    redirect(statusUrl("blocked", "AUTH_UNEXPECTED"));
  }
}
