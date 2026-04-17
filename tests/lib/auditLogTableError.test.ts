import { describe, expect, it } from "vitest";

import {
  isAuditLogMissingColumnError,
  isAuditLogRouteDegradableError,
  isAuditLogTableUnavailableError,
  resolveAuditLogDegradedPayload,
} from "@/lib/cms/auditLogTableError";

describe("isAuditLogTableUnavailableError", () => {
  it("detects 42P01", () => {
    expect(isAuditLogTableUnavailableError({ code: "42P01", message: "n/a" })).toBe(true);
  });

  it("detects PostgREST schema cache message", () => {
    expect(
      isAuditLogTableUnavailableError({
        message: "Could not find the table 'public.content_audit_log' in the schema cache",
      })
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isAuditLogTableUnavailableError({ message: "timeout" })).toBe(false);
  });
});

describe("resolveAuditLogDegradedPayload", () => {
  it("classifies missing audit columns as degraded payload", () => {
    const payload = resolveAuditLogDegradedPayload({
      code: "42703",
      message: 'column "actor_email" of relation "content_audit_log" does not exist',
    });

    expect(isAuditLogMissingColumnError({
      code: "42703",
      message: 'column "actor_email" of relation "content_audit_log" does not exist',
    })).toBe(true);
    expect(isAuditLogRouteDegradableError({
      code: "42703",
      message: 'column "actor_email" of relation "content_audit_log" does not exist',
    })).toBe(true);
    expect(payload?.reason).toBe("COLUMN_MISSING");
    expect(payload?.schemaHints.columnMissing).toBe(true);
    expect(payload?.schemaHints.code).toBe("42703");
  });

  it("returns null for unrelated failures", () => {
    expect(resolveAuditLogDegradedPayload({ message: "timeout" })).toBeNull();
    expect(isAuditLogRouteDegradableError({ message: "timeout" })).toBe(false);
  });
});
