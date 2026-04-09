// lib/system/health.ts
import "server-only";

import { withTimeout } from "@/lib/core/asyncOps";
import { HEALTH_SUBPROBE_TIMEOUT_MS } from "@/lib/core/limits";
import { getRuntimeFacts } from "@/lib/system/runtimeFacts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { osloTodayISODate } from "@/lib/date/oslo";
import { getControlCoverageReport } from "@/lib/system/controlCoverage";

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
     2b) Intelligence store readable
  ========================= */
  try {
    const sb = supabaseAdmin();
    const { error } = await withTimeout(
      sb.from("ai_intelligence_events").select("id").limit(1),
      HEALTH_SUBPROBE_TIMEOUT_MS,
      "intelligence_read",
    );
    if (error) {
      checks.push({
        key: "intelligence_read",
        label: "Intelligence (read)",
        status: "fail",
        message: "Kunne ikke lese ai_intelligence_events.",
        detail: { code: error.code, message: error.message },
      });
    } else {
      checks.push({
        key: "intelligence_read",
        label: "Intelligence (read)",
        status: "ok",
        message: "Intelligence-tabell svarer (select 1).",
      });
    }
  } catch (e) {
    checks.push({
      key: "intelligence_read",
      label: "Intelligence (read)",
      status: "fail",
      message: "Intelligence read-probe feilet eller timeout.",
      detail: safeErr(e),
    });
  }

  /* =========================
     2c) AI activity log readable
  ========================= */
  try {
    const sb = supabaseAdmin();
    const { error } = await withTimeout(
      sb.from("ai_activity_log").select("id").limit(1),
      HEALTH_SUBPROBE_TIMEOUT_MS,
      "ai_activity_read",
    );
    if (error) {
      checks.push({
        key: "ai_activity_read",
        label: "AI activity log (read)",
        status: "warn",
        message: "Kunne ikke lese ai_activity_log (kan være migrering/RLS).",
        detail: { code: error.code, message: error.message },
      });
    } else {
      checks.push({
        key: "ai_activity_read",
        label: "AI activity log (read)",
        status: "ok",
        message: "ai_activity_log svarer (select 1).",
      });
    }
  } catch (e) {
    checks.push({
      key: "ai_activity_read",
      label: "AI activity log (read)",
      status: "warn",
      message: "AI activity read-probe feilet eller timeout.",
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
     5) Repo control-plane (static AI/CMS/DS scan)
  ========================= */
  try {
    const repo = getControlCoverageReport();
    const m = repo.metrics;
    const violations =
      repo.aiViolations.length + repo.cmsViolations.length + repo.growthViolations.length;
    const minPct = Math.min(m.aiCoverage, m.cmsCoverage, m.dsUsage, m.growthIsolation);
    checks.push({
      key: "control_repo",
      label: "Kontrollplan (repo-scan)",
      status: violations === 0 && minPct === 100 ? "ok" : "warn",
      message:
        violations === 0
          ? `AI ${m.aiCoverage}% · CMS ${m.cmsCoverage}% · DS ${m.dsUsage}% · vekst ${m.growthIsolation}%`
          : `${violations} avvik i repo (se detail).`,
      detail: {
        metrics: m,
        aiViolations: repo.aiViolations,
        cmsViolations: repo.cmsViolations,
        growthViolations: repo.growthViolations,
      },
    });
  } catch (e) {
    checks.push({
      key: "control_repo",
      label: "Kontrollplan (repo-scan)",
      status: "skip",
      message: "Repo-scan utilgjengelig.",
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

/* =========================================================
   Repo control-plane metrics (static scan) — re-export
========================================================= */

export {
  getSystemHealth,
  getControlCoverageReport,
  getControlViolationMarkers,
  logControlCoverageErrors,
  logControlCoverageSuggestions,
  logDevControlPlaneSummary,
  type SystemHealthMetrics,
  type ControlCoverageReport,
  type ControlViolationMarker,
} from "@/lib/system/controlCoverage";
