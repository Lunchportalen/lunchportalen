import { describe, expect, it } from "vitest";

import {
  menuScopeDecision,
  resolveProviderMenuScopeForCompany,
  type ProviderMenuScopeResult,
} from "@/lib/menu/providerMenuScope";

type Row = Record<string, unknown>;

/** Minimal chainable fake for `.from(t).select(c).eq(col, v).maybeSingle()`. */
function fakeDb(opts: {
  companies?: Map<string, Row>;
  providers?: Map<string, Row>;
  companiesError?: string;
  providersError?: string;
}) {
  return {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, id: string) {
              return {
                async maybeSingle() {
                  if (table === "companies") {
                    if (opts.companiesError) return { data: null, error: { message: opts.companiesError } };
                    return { data: opts.companies?.get(id) ?? null, error: null };
                  }
                  if (table === "providers") {
                    if (opts.providersError) return { data: null, error: { message: opts.providersError } };
                    return { data: opts.providers?.get(id) ?? null, error: null };
                  }
                  return { data: null, error: { message: `unexpected table: ${table}` } };
                },
              };
            },
          };
        },
      };
    },
  };
}

const PROVIDER_A = { id: "prov-a", slug: "provider-a", name: "Provider A AS" };
const PROVIDER_B = { id: "prov-b", slug: "provider-b", name: "Provider B AS" };

const twoProviderDb = fakeDb({
  companies: new Map([
    ["comp-a", { id: "comp-a", provider_id: "prov-a" }],
    ["comp-b", { id: "comp-b", provider_id: "prov-b" }],
    ["comp-legacy", { id: "comp-legacy", provider_id: null }],
  ]),
  providers: new Map([
    ["prov-a", PROVIDER_A],
    ["prov-b", PROVIDER_B],
  ]),
});

describe("resolveProviderMenuScopeForCompany", () => {
  it("finner provider via companies.provider_id", async () => {
    const res = await resolveProviderMenuScopeForCompany(twoProviderDb, "comp-a");
    expect(res).toEqual({
      ok: true,
      scope: { providerId: "prov-a", providerSlug: "provider-a", providerName: "Provider A AS" },
    });
  });

  it("provider A/B-isolasjon: company B får provider B-scope, aldri provider A", async () => {
    const resA = await resolveProviderMenuScopeForCompany(twoProviderDb, "comp-a");
    const resB = await resolveProviderMenuScopeForCompany(twoProviderDb, "comp-b");
    expect(resA.ok && resA.scope.providerSlug).toBe("provider-a");
    expect(resB.ok && resB.scope.providerSlug).toBe("provider-b");
    expect(resA.ok && resB.ok && resA.scope.providerId !== resB.scope.providerId).toBe(true);
  });

  it("company uten provider_id → NO_PROVIDER", async () => {
    const res = await resolveProviderMenuScopeForCompany(twoProviderDb, "comp-legacy");
    expect(res).toEqual({ ok: false, reason: "NO_PROVIDER" });
  });

  it("ukjent company → COMPANY_NOT_FOUND", async () => {
    const res = await resolveProviderMenuScopeForCompany(twoProviderDb, "comp-unknown");
    expect(res).toEqual({ ok: false, reason: "COMPANY_NOT_FOUND" });
  });

  it("tom companyId → COMPANY_NOT_FOUND uten DB-kall", async () => {
    const res = await resolveProviderMenuScopeForCompany(twoProviderDb, "   ");
    expect(res).toEqual({ ok: false, reason: "COMPANY_NOT_FOUND" });
  });

  it("companies-lookup-feil → LOOKUP_FAILED", async () => {
    const db = fakeDb({ companiesError: "connection refused" });
    const res = await resolveProviderMenuScopeForCompany(db, "comp-a");
    expect(res).toMatchObject({ ok: false, reason: "LOOKUP_FAILED" });
  });

  it("provider_id satt men providers-rad mangler → LOOKUP_FAILED (aldri stille unscoped)", async () => {
    const db = fakeDb({
      companies: new Map([["comp-a", { id: "comp-a", provider_id: "prov-deleted" }]]),
      providers: new Map(),
    });
    const res = await resolveProviderMenuScopeForCompany(db, "comp-a");
    expect(res).toMatchObject({ ok: false, reason: "LOOKUP_FAILED" });
  });

  it("provider uten slug → ok med providerSlug null", async () => {
    const db = fakeDb({
      companies: new Map([["comp-a", { id: "comp-a", provider_id: "prov-a" }]]),
      providers: new Map([["prov-a", { id: "prov-a", slug: "", name: "Uten Slug AS" }]]),
    });
    const res = await resolveProviderMenuScopeForCompany(db, "comp-a");
    expect(res).toEqual({
      ok: true,
      scope: { providerId: "prov-a", providerSlug: null, providerName: "Uten Slug AS" },
    });
  });
});

describe("menuScopeDecision", () => {
  it("provider med slug → scoped query", () => {
    const result: ProviderMenuScopeResult = {
      ok: true,
      scope: { providerId: "prov-a", providerSlug: "provider-a", providerName: "Provider A AS" },
    };
    expect(menuScopeDecision(result)).toEqual({
      mode: "scoped",
      providerId: "prov-a",
      providerSlug: "provider-a",
    });
  });

  it("provider uten slug → scoped via providerRef (aldri unscoped)", () => {
    const result: ProviderMenuScopeResult = {
      ok: true,
      scope: { providerId: "prov-a", providerSlug: null, providerName: "Provider A AS" },
    };
    expect(menuScopeDecision(result)).toEqual({
      mode: "scoped",
      providerId: "prov-a",
      providerSlug: null,
    });
  });

  it("NO_PROVIDER → legacy unscoped (dagens atferd for legacy company)", () => {
    expect(menuScopeDecision({ ok: false, reason: "NO_PROVIDER" })).toEqual({ mode: "legacy-unscoped" });
  });

  it("LOOKUP_FAILED → fail-closed", () => {
    expect(menuScopeDecision({ ok: false, reason: "LOOKUP_FAILED" })).toEqual({
      mode: "fail-closed",
      reason: "LOOKUP_FAILED",
    });
  });

  it("COMPANY_NOT_FOUND → fail-closed", () => {
    expect(menuScopeDecision({ ok: false, reason: "COMPANY_NOT_FOUND" })).toEqual({
      mode: "fail-closed",
      reason: "COMPANY_NOT_FOUND",
    });
  });
});
