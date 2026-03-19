/**
 * Content outbox invariants:
 * - fingerprintDraft is deterministic and sensitive to all fields
 * - getOutboxEntryKey chooses id → rid → savedAtLocal → fallback
 * - safeJsonBytes reports length or null on non-serializable input
 * - getOutboxUiStatus classifies pending / retrying / failed correctly
 */

// @ts-nocheck

import { describe, test, expect } from "vitest";

import {
  fingerprintDraft,
  getOutboxEntryKey,
  safeJsonBytes,
  getOutboxUiStatus,
  type OutboxDraft,
} from "@/app/(backoffice)/backoffice/content/_components/contentOutbox";

describe("contentOutbox – fingerprintDraft", () => {
  test("returns same fingerprint for identical drafts", () => {
    const draft: OutboxDraft = {
      title: "Title",
      slug: "slug",
      status: "draft",
      body: '{"blocks":[]}',
    };

    const a = fingerprintDraft(draft);
    const b = fingerprintDraft({ ...draft });

    expect(typeof a).toBe("string");
    expect(a).toBe(b);
  });

  test("changes when any field changes", () => {
    const base: OutboxDraft = {
      title: "Title",
      slug: "slug",
      status: "draft",
      body: '{"blocks":[]}',
    };

    const fpBase = fingerprintDraft(base);
    const fpOtherSlug = fingerprintDraft({ ...base, slug: "other" });
    const fpOtherBody = fingerprintDraft({ ...base, body: '{"blocks":[1]}' });

    expect(fpOtherSlug).not.toBe(fpBase);
    expect(fpOtherBody).not.toBe(fpBase);
  });
});

describe("contentOutbox – getOutboxEntryKey", () => {
  test("prefers id, then rid, then savedAtLocal, then fallback", () => {
    expect(
      getOutboxEntryKey({
        id: "entry-id",
        rid: "rid-x",
        savedAtLocal: "2026-03-12T10:00:00Z",
        pageId: "page-1",
      }),
    ).toBe("entry-id");

    expect(
      getOutboxEntryKey({
        rid: "rid-x",
        savedAtLocal: "2026-03-12T10:00:00Z",
        pageId: "page-1",
      }),
    ).toBe("rid-x");

    expect(
      getOutboxEntryKey({
        savedAtLocal: "2026-03-12T10:00:00Z",
        pageId: "page-1",
      }),
    ).toBe("2026-03-12T10:00:00Z");

    expect(
      getOutboxEntryKey({
        pageId: "page-1",
      }),
    ).toBe("page-1:na");
  });
});

describe("contentOutbox – safeJsonBytes", () => {
  test("returns length for serializable input", () => {
    const n = safeJsonBytes({ a: 1, b: "x" });
    expect(typeof n).toBe("number");
    expect(n).toBeGreaterThan(0);
  });

  test("returns null when JSON.stringify throws", () => {
    const value: any = {};
    value.self = value; // circular reference
    const n = safeJsonBytes(value);
    expect(n).toBeNull();
  });
});

describe("contentOutbox – getOutboxUiStatus", () => {
  test("returns pending for null/unknown shapes", () => {
    expect(getOutboxUiStatus(null)).toEqual({
      key: "pending",
      label: "Pending",
      tone: "neutral",
    });
    expect(getOutboxUiStatus({})).toEqual({
      key: "pending",
      label: "Pending",
      tone: "neutral",
    });
  });

  test("returns retrying when state indicates retry", () => {
    expect(getOutboxUiStatus({ isRetrying: true }).key).toBe("retrying");
    expect(getOutboxUiStatus({ inFlight: true }).key).toBe("retrying");
    expect(getOutboxUiStatus({ state: "retrying" }).key).toBe("retrying");
    expect(getOutboxUiStatus({ status: "retrying" }).key).toBe("retrying");
  });

  test("returns failed when error fields or failed state present", () => {
    expect(getOutboxUiStatus({ lastError: "boom" }).key).toBe("failed");
    expect(getOutboxUiStatus({ errorMessage: "fail" }).key).toBe("failed");
    expect(getOutboxUiStatus({ failureReason: "oops" }).key).toBe("failed");
    expect(getOutboxUiStatus({ state: "failed" }).key).toBe("failed");
    expect(getOutboxUiStatus({ status: "failed" }).key).toBe("failed");
    expect(getOutboxUiStatus({ status: "error" }).key).toBe("failed");
  });
});

