/**
 * Read-only, in-memory anomaly hints from audit-shaped rows.
 * No I/O, no side effects. Safe for client or server.
 */

const MS_10M = 10 * 60 * 1000;

/** Minimal row shape (matches dashboard `SecurityAuditEvent` fields used here). */
export type AnomalyAuditEvent = {
  created_at: string;
  action: string | null;
  detail: Record<string, unknown> | null;
};

export type SecurityAnomalyType = "TENANT_ATTACK" | "ACCESS_ANOMALY" | "LOGIN_ATTACK" | "AI_ABUSE";

export type SecurityAnomalySeverity = "CRITICAL" | "WARNING";

export type SecurityAnomaly = {
  type: SecurityAnomalyType;
  severity: SecurityAnomalySeverity;
  count: number;
  /** Same metric in the previous 10-minute window (for trend). */
  previousWindowCount: number;
  /** Set when anomaly threshold met and current window strictly exceeds previous. */
  trend: "up" | null;
  explanation: string;
};

function eventMs(e: AnomalyAuditEvent): number {
  const t = Date.parse(e.created_at);
  return Number.isFinite(t) ? t : NaN;
}

function inLastMinutes(events: readonly AnomalyAuditEvent[], now: number, minutes: number): AnomalyAuditEvent[] {
  const start = now - minutes * 60 * 1000;
  return events.filter((e) => {
    const ts = eventMs(e);
    return Number.isFinite(ts) && ts > start && ts <= now;
  });
}

function inPreviousWindow(
  events: readonly AnomalyAuditEvent[],
  now: number,
  windowMinutes: number,
): AnomalyAuditEvent[] {
  const end = now - windowMinutes * 60 * 1000;
  const start = now - 2 * windowMinutes * 60 * 1000;
  return events.filter((e) => {
    const ts = eventMs(e);
    return Number.isFinite(ts) && ts > start && ts <= end;
  });
}

function isFailedLogin(e: AnomalyAuditEvent): boolean {
  if (e.action !== "LOGIN") return false;
  const d = e.detail;
  if (d && String(d.outcome ?? "") === "failure") return true;
  const meta = d && typeof d === "object" && "metadata" in d ? (d as { metadata?: { outcome?: unknown } }).metadata : undefined;
  return String(meta?.outcome ?? "") === "failure";
}

/**
 * Conservative thresholds on the last 10 minutes vs prior 10 minutes (trend ↑ only when current > previous).
 */
export function detectSecurityAnomalies(
  events: readonly AnomalyAuditEvent[],
  nowMs: number = Date.now(),
): SecurityAnomaly[] {
  const last10 = inLastMinutes(events, nowMs, 10);
  const prev10 = inPreviousWindow(events, nowMs, 10);

  const anomalies: SecurityAnomaly[] = [];

  const tenantViolations = last10.filter((e) => e.action === "TENANT_VIOLATION");
  const tenantPrev = prev10.filter((e) => e.action === "TENANT_VIOLATION");
  if (tenantViolations.length >= 3) {
    const prev = tenantPrev.length;
    anomalies.push({
      type: "TENANT_ATTACK",
      severity: "CRITICAL",
      count: tenantViolations.length,
      previousWindowCount: prev,
      trend: tenantViolations.length > prev ? "up" : null,
      explanation:
        "Flere tenant-brudd på kort tid kan tyde på automatisert eller koordinert scope-probing.",
    });
  }

  const denied = last10.filter((e) => e.action === "ACCESS_DENIED");
  const deniedPrev = prev10.filter((e) => e.action === "ACCESS_DENIED");
  if (denied.length >= 5) {
    const prev = deniedPrev.length;
    anomalies.push({
      type: "ACCESS_ANOMALY",
      severity: "WARNING",
      count: denied.length,
      previousWindowCount: prev,
      trend: denied.length > prev ? "up" : null,
      explanation: "Høy frekvens av avvist tilgang i vinduet — verifiser mønstre og kilder.",
    });
  }

  const failedLogins = last10.filter(isFailedLogin);
  const failedPrev = prev10.filter(isFailedLogin);
  if (failedLogins.length >= 3) {
    const prev = failedPrev.length;
    anomalies.push({
      type: "LOGIN_ATTACK",
      severity: "CRITICAL",
      count: failedLogins.length,
      previousWindowCount: prev,
      trend: failedLogins.length > prev ? "up" : null,
      explanation: "Mange mislykkede innlogginger på kort tid — vurder konto- eller nettverksnivå.",
    });
  }

  const aiRuns = last10.filter((e) => e.action === "AI_EXECUTION");
  const aiPrev = prev10.filter((e) => e.action === "AI_EXECUTION");
  if (aiRuns.length >= 20) {
    const prev = aiPrev.length;
    anomalies.push({
      type: "AI_ABUSE",
      severity: "WARNING",
      count: aiRuns.length,
      previousWindowCount: prev,
      trend: aiRuns.length > prev ? "up" : null,
      explanation: "Uvanlig høy AI-kjøringsrate i vinduet — kan være automatisering eller batch.",
    });
  }

  return anomalies;
}
