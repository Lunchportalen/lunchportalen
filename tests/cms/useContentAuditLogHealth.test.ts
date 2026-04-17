import { describe, expect, it } from "vitest";

/**
 * Pure mapping helpers mirror client hook behaviour for stable tests (no fetch).
 */
function degradedFromAuditPayload(json: { ok?: boolean; data?: { degraded?: boolean } } | null, status: number): boolean | null {
  if (status === 403 || status === 401) return null;
  if (json?.ok === true && json?.data && typeof json.data.degraded === "boolean") return json.data.degraded;
  return null;
}

describe("useContentAuditLogHealth mapping (U31)", () => {
  it("403 yields null", () => {
    expect(degradedFromAuditPayload({ ok: false }, 403)).toBe(null);
  });

  it("200 ok with degraded true", () => {
    expect(degradedFromAuditPayload({ ok: true, data: { degraded: true } }, 200)).toBe(true);
  });

  it("200 ok with degraded false", () => {
    expect(degradedFromAuditPayload({ ok: true, data: { degraded: false } }, 200)).toBe(false);
  });
});
