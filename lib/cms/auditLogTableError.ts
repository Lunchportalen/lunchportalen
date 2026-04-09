/**
 * U30R — Klassifisering av Supabase/Postgres-feil for content_audit_log (én sann logikk for rute + tester).
 */

function serializeError(e: unknown): string {
  if (e == null) return "Unknown error";
  if (e instanceof Error) return e.message || e.name || "Error";
  if (typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  try {
    const s = JSON.stringify(e);
    return s.length > 500 ? s.slice(0, 500) + "…" : s;
  } catch {
    return String(e);
  }
}

function getErrorCode(e: unknown): string | null {
  return typeof (e as { code?: unknown })?.code === "string"
    ? ((e as { code: string }).code ?? null)
    : null;
}

function getErrorMessage(e: unknown): string {
  const msg = serializeError(e).toLowerCase();
  return typeof msg === "string" ? msg : "";
}

/** True når tabellen ikke er tilgjengelig (migrasjon, schema cache, manglende relasjon). */
export function isAuditLogTableUnavailableError(e: unknown): boolean {
  const code = getErrorCode(e) ?? "";
  const msg = getErrorMessage(e);
  if (code === "42P01") return true;
  if (code === "PGRST204" && msg.includes("content_audit_log")) return true;
  if (msg.includes("content_audit_log") && (msg.includes("does not exist") || msg.includes("relation"))) return true;
  if (msg.includes("schema cache") && msg.includes("content_audit_log")) return true;
  if (msg.includes("could not find the table") && msg.includes("content_audit_log")) return true;
  if (msg.includes("permission denied") && msg.includes("content_audit_log")) return true;
  return false;
}

export function isAuditLogMissingColumnError(e: unknown): boolean {
  const code = getErrorCode(e) ?? "";
  const message = getErrorMessage(e);
  return code === "42703" && message.includes("content_audit_log") && message.includes("column");
}

export function isAuditLogSchemaCacheError(e: unknown): boolean {
  const message = getErrorMessage(e);
  return (
    message.includes("content_audit_log") &&
    (message.includes("schema cache") || message.includes("could not find the table"))
  );
}

export type AuditLogDegradedReason =
  | "COLUMN_MISSING"
  | "SCHEMA_CACHE_UNAVAILABLE"
  | "TABLE_MISSING";

export type AuditLogDegradedPayload = {
  reason: AuditLogDegradedReason;
  operatorMessage: string;
  operatorAction: string;
  schemaHints: {
    auditLogUnavailable: true;
    tableMissing?: true;
    columnMissing?: true;
    schemaCacheUnavailable?: true;
    detail: string;
    code: string | null;
  };
};

export function resolveAuditLogDegradedPayload(e: unknown): AuditLogDegradedPayload | null {
  const detail = serializeError(e);
  const code = getErrorCode(e);

  if (isAuditLogMissingColumnError(e)) {
    return {
      reason: "COLUMN_MISSING",
      operatorMessage:
        "Audit-logg er degradert fordi en eller flere kolonner mangler i content_audit_log i dette miljøet.",
      operatorAction:
        "Kjør migrasjonen som legger til manglende audit-kolonner og refresh schema/cache før du stoler på tidslinjen igjen.",
      schemaHints: {
        auditLogUnavailable: true,
        columnMissing: true,
        detail,
        code,
      },
    };
  }

  if (isAuditLogSchemaCacheError(e)) {
    return {
      reason: "SCHEMA_CACHE_UNAVAILABLE",
      operatorMessage:
        "Audit-logg er degradert fordi schema/cache ikke kunne lese content_audit_log korrekt i dette miljøet.",
      operatorAction:
        "Oppdater schema/cache eller kjør ventende migrasjoner før du stoler på audit-tidslinjen igjen.",
      schemaHints: {
        auditLogUnavailable: true,
        schemaCacheUnavailable: true,
        detail,
        code,
      },
    };
  }

  if (isAuditLogTableUnavailableError(e)) {
    return {
      reason: "TABLE_MISSING",
      operatorMessage:
        "Audit-logg er degradert fordi content_audit_log mangler eller er utilgjengelig i dette miljøet.",
      operatorAction:
        "Opprett eller gjenopprett content_audit_log-tabellen og last arbeidsloggen på nytt.",
      schemaHints: {
        auditLogUnavailable: true,
        tableMissing: true,
        detail,
        code,
      },
    };
  }

  return null;
}

export function isAuditLogRouteDegradableError(e: unknown): boolean {
  return Boolean(resolveAuditLogDegradedPayload(e));
}

export { serializeError as serializeAuditError };
