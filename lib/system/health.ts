// lib/system/health.ts
import "server-only";

import { getRuntimeFacts } from "@/lib/system/runtimeFacts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { osloTodayISODate } from "@/lib/date/oslo";

/* =========================================================
   Types
========================================================= */

export type HealthStatus = "ok" | "fail" | "warn" | "skip";

export type HealthCheck = {
  key: string;
  label: string;
  status: HealthStatus;
  message: string;
  detail?: any;
};

export type HealthReport = {
  ok: boolean;
  timestamp: string; // ISO
  todayOslo: string; // YYYY-MM-DD
  checks: HealthCheck[];
};

/* =========================================================
   Helpers
========================================================= */

function nowIso() {
  return new Date().toISOString();
}

function safeErr(e: unknown) {
  if (!e) return { name: "Error", message: "Unknown error" };
  if (e instanceof Error) return { name: e.name, message: e.message, stack: e.stack };
  return { name: "Error", message: String(e) };
}

function toNbOslo(d: Date = new Date()) {
  try {
    return d.toLocaleString("nb-NO", {
      timeZone: "Europe/Oslo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return null;
  }
}

/* =========================================================
   Health runner (LIGHT MODE)
========================================================= */

export async function runHealthChecks(): Promise<HealthReport> {
  const checks: HealthCheck[] = [];

  /* =========================
     1) Runtime facts
  ========================= */
  try {
    const facts = getRuntimeFacts(); // fail-fast hvis env mangler
    checks.push({
      key: "runtime",
      label: "Runtime config",
      status: "ok",
      message: "Runtime facts OK (env til stede).",
      detail: {
        timezone: facts.timezone,
        cutoff: facts.cutoffTimeLocal,
        orderBackupEmail: facts.orderBackupEmail,
        smtpHost: facts.smtpHost,
        smtpPorts: facts.smtpPorts,
        imapHost: facts.imapHost,
        imapPort: facts.imapPort,
      },
    });
  } catch (e) {
    checks.push({
      key: "runtime",
      label: "Runtime config",
      status: "fail",
      message: "Mangler env / runtime config.",
      detail: safeErr(e),
    });
  }

  /* =========================
     2) Database ping
  ========================= */
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("profiles").select("id").limit(1);

    if (error) {
      checks.push({
        key: "db",
        label: "Database",
        status: "fail",
        message: "DB query feilet.",
        detail: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
      });
    } else {
      checks.push({
        key: "db",
        label: "Database",
        status: "ok",
        message: "DB OK (profiles select 1).",
        detail: {
          rowCount: Array.isArray(data) ? data.length : 0,
        },
      });
    }
  } catch (e) {
    checks.push({
      key: "db",
      label: "Database",
      status: "fail",
      message: "DB klient eller tilkobling feilet.",
      detail: safeErr(e),
    });
  }

  /* =========================
     3) Sanity (valgfritt lag)
  ========================= */
  try {
    const today = osloTodayISODate();
    const mod = await import("@/lib/sanity/queries");
    const fn = (mod as any)?.getClosedDatesForDate;

    if (typeof fn !== "function") {
      checks.push({
        key: "sanity",
        label: "Sanity",
        status: "skip",
        message: "Sanity helper ikke funnet (getClosedDatesForDate).",
      });
    } else {
      const res = await fn(today);
      checks.push({
        key: "sanity",
        label: "Sanity",
        status: "ok",
        message: "Sanity OK (getClosedDatesForDate).",
        detail: { today, resultType: typeof res },
      });
    }
  } catch (e) {
    checks.push({
      key: "sanity",
      label: "Sanity",
      status: "warn",
      message: "Sanity check feilet eller ikke konfigurert.",
      detail: safeErr(e),
    });
  }

  /* =========================
     4) Timezone / Oslo
  ========================= */
  try {
    const oslo = toNbOslo(new Date());
    if (!oslo) {
      checks.push({
        key: "time",
        label: "Time (Europe/Oslo)",
        status: "fail",
        message: "Klarte ikke formatere tid i Europe/Oslo.",
      });
    } else {
      checks.push({
        key: "time",
        label: "Time (Europe/Oslo)",
        status: "ok",
        message: "Time zone OK.",
        detail: { osloNow: oslo },
      });
    }
  } catch (e) {
    checks.push({
      key: "time",
      label: "Time (Europe/Oslo)",
      status: "fail",
      message: "Time zone check feilet.",
      detail: safeErr(e),
    });
  }

  /* =========================
     Final verdict (operational truth: no optimistic ok)
  ========================= */
  const ok = checks.every((c) => c.status === "ok" || c.status === "skip");

  return {
    ok,
    timestamp: nowIso(),
    todayOslo: osloTodayISODate(),
    checks,
  };
}
