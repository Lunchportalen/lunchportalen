import { describe, expect, it } from "vitest";

import {
  extractMenuDayProviderRef,
  resolveMenuDayProviderScope,
} from "@/lib/menu-publish/resolveMenuDayProvider";

const PROVIDER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

type ProviderRow = { id: string; slug: string | null };

function makeDb(rows: ProviderRow[], opts?: { error?: string; throwOnFetch?: boolean }) {
  return {
    from(table: string) {
      const chain = {
        select() {
          return chain;
        },
        eq(_col: string, val: string) {
          (chain as { _id?: string })._id = val;
          return chain;
        },
        maybeSingle() {
          if (opts?.throwOnFetch) throw new Error("network down");
          if (opts?.error) return Promise.resolve({ data: null, error: { message: opts.error } });
          if (table !== "providers") return Promise.resolve({ data: null, error: null });
          const id = (chain as { _id?: string })._id;
          const row = rows.find((r) => r.id === id) ?? null;
          return Promise.resolve({ data: row, error: null });
        },
      };
      return chain;
    },
  };
}

describe("extractMenuDayProviderRef", () => {
  it("leser provider._ref fra webhook-dokument", () => {
    const doc = { _type: "menuDay", provider: { _type: "reference", _ref: PROVIDER_A } };
    expect(extractMenuDayProviderRef(doc)).toBe(PROVIDER_A);
  });

  it("leser flat providerRef fra GROQ-projeksjon", () => {
    expect(extractMenuDayProviderRef({ providerRef: PROVIDER_A })).toBe(PROVIDER_A);
  });

  it("returnerer tom streng når provider mangler — ingen fallback", () => {
    expect(extractMenuDayProviderRef({ _type: "menuDay" })).toBe("");
    expect(extractMenuDayProviderRef({ provider: {} })).toBe("");
    expect(extractMenuDayProviderRef(null)).toBe("");
    expect(extractMenuDayProviderRef(undefined)).toBe("");
  });
});

describe("resolveMenuDayProviderScope", () => {
  it("mapper Sanity provider._ref til Supabase providers.id", async () => {
    const db = makeDb([{ id: PROVIDER_A, slug: "provider-a" }]);
    const result = await resolveMenuDayProviderScope(db, PROVIDER_A);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scope.providerId).toBe(PROVIDER_A);
      expect(result.scope.providerSlug).toBe("provider-a");
    }
  });

  it("fail-closed: tom ref → MISSING_PROVIDER_REF (ingen Melhus/første-provider fallback)", async () => {
    const db = makeDb([{ id: PROVIDER_A, slug: "provider-a" }]);
    const result = await resolveMenuDayProviderScope(db, "");
    expect(result).toEqual({ ok: false, reason: "MISSING_PROVIDER_REF" });
  });

  it("fail-closed: ukjent provider → PROVIDER_NOT_FOUND", async () => {
    const db = makeDb([{ id: PROVIDER_A, slug: "provider-a" }]);
    const result = await resolveMenuDayProviderScope(db, "ffffffff-ffff-ffff-ffff-ffffffffffff");
    expect(result).toEqual({ ok: false, reason: "PROVIDER_NOT_FOUND" });
  });

  it("fail-closed: lookup-feil → LOOKUP_FAILED", async () => {
    const db = makeDb([], { error: "connection refused" });
    const result = await resolveMenuDayProviderScope(db, PROVIDER_A);
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reason).toBe("LOOKUP_FAILED");
  });

  it("fail-closed: kastet exception → LOOKUP_FAILED", async () => {
    const db = makeDb([], { throwOnFetch: true });
    const result = await resolveMenuDayProviderScope(db, PROVIDER_A);
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reason).toBe("LOOKUP_FAILED");
  });

  it("ingen Melhus-hardcoding: helperen inneholder ingen provider-konstanter", async () => {
    // Runtime-bevis: ukjent ref gir aldri en annen providers id tilbake.
    const db = makeDb([
      { id: PROVIDER_A, slug: "provider-a" },
      { id: "11111111-1111-1111-1111-111111111111", slug: "melhus-catering" },
    ]);
    const result = await resolveMenuDayProviderScope(db, "00000000-0000-0000-0000-000000000099");
    expect(result).toEqual({ ok: false, reason: "PROVIDER_NOT_FOUND" });
  });
});
