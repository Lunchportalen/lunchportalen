// syncProviderToSanity — fail-closed provider-speiling (P0 multi-provider):
// - tomme providerfelt (name/slug) skal ALDRI falle tilbake til Melhus
// - eksplisitt Melhus-sync fungerer fortsatt (syncMelhusProviderToSanity)
import { describe, expect, it, vi, beforeEach } from "vitest";

import { MELHUS_PROVIDER_SANITY_ID } from "@/lib/cms/providerSanityConstants";

type ProviderRow = {
  id: string;
  name: string | null;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  status: string | null;
};

const dbState = vi.hoisted(() => ({
  rowsById: new Map<string, ProviderRow>(),
}));

const sanityProbe = vi.hoisted(() => ({
  createdDocs: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => ({
            data: dbState.rowsById.get(id) ?? null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/sanity/client", () => ({
  requireSanityWrite: () => ({
    fetch: async () => false,
    createOrReplace: async (doc: Record<string, unknown>) => {
      sanityProbe.createdDocs.push(doc);
      return doc;
    },
  }),
}));

const PROVIDER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("syncProviderToSanity — fail-closed, ingen Melhus-fallback", () => {
  beforeEach(() => {
    dbState.rowsById.clear();
    sanityProbe.createdDocs = [];
    vi.resetModules();
  });

  it("provider med tomt name → kaster fail-closed, ingen Sanity-write", async () => {
    dbState.rowsById.set(PROVIDER_B, {
      id: PROVIDER_B,
      name: "   ",
      slug: "provider-b",
      logo_url: null,
      primary_color: null,
      status: "ACTIVE",
    });

    const mod = await import("@/lib/cms/syncProviderToSanity");
    await expect(mod.syncProviderToSanity(PROVIDER_B)).rejects.toThrow(/mangler name/);
    await expect(mod.syncProviderToSanity(PROVIDER_B)).rejects.toThrow(/ingen Melhus-fallback/);
    expect(sanityProbe.createdDocs).toHaveLength(0);
  });

  it("provider med tom slug → kaster fail-closed, ingen Sanity-write", async () => {
    dbState.rowsById.set(PROVIDER_B, {
      id: PROVIDER_B,
      name: "Provider B AS",
      slug: "",
      logo_url: null,
      primary_color: null,
      status: "ACTIVE",
    });

    const mod = await import("@/lib/cms/syncProviderToSanity");
    await expect(mod.syncProviderToSanity(PROVIDER_B)).rejects.toThrow(/mangler slug/);
    expect(sanityProbe.createdDocs).toHaveLength(0);
  });

  it("gyldig provider B speiles med EGNE felt — aldri Melhus-navn/-slug", async () => {
    dbState.rowsById.set(PROVIDER_B, {
      id: PROVIDER_B,
      name: "Provider B AS",
      slug: "provider-b",
      logo_url: null,
      primary_color: null,
      status: "ACTIVE",
    });

    const mod = await import("@/lib/cms/syncProviderToSanity");
    const res = await mod.syncProviderToSanity(PROVIDER_B);

    expect(res.ok).toBe(true);
    expect(res.sanityId).toBe(PROVIDER_B);
    expect(sanityProbe.createdDocs).toHaveLength(1);

    const doc = sanityProbe.createdDocs[0];
    expect(doc._id).toBe(PROVIDER_B);
    expect(doc.name).toBe("Provider B AS");
    expect((doc.slug as { current?: string })?.current).toBe("provider-b");
    expect(doc.name).not.toBe("Melhus Catering AS");
    expect((doc.slug as { current?: string })?.current).not.toBe("melhus-catering");
  });

  it("ukjent providerId → kaster (provider not found), ingen Sanity-write", async () => {
    const mod = await import("@/lib/cms/syncProviderToSanity");
    await expect(mod.syncProviderToSanity(PROVIDER_B)).rejects.toThrow(/provider not found/);
    expect(sanityProbe.createdDocs).toHaveLength(0);
  });

  it("eksplisitt Melhus-sync fungerer fortsatt (egne felt fra Supabase-raden)", async () => {
    dbState.rowsById.set(MELHUS_PROVIDER_SANITY_ID, {
      id: MELHUS_PROVIDER_SANITY_ID,
      name: "Melhus Catering AS",
      slug: "melhus-catering",
      logo_url: null,
      primary_color: null,
      status: "ACTIVE",
    });

    const mod = await import("@/lib/cms/syncProviderToSanity");
    const res = await mod.syncMelhusProviderToSanity();

    expect(res.ok).toBe(true);
    expect(res.sanityId).toBe(MELHUS_PROVIDER_SANITY_ID);
    expect(sanityProbe.createdDocs).toHaveLength(1);
    expect(sanityProbe.createdDocs[0].name).toBe("Melhus Catering AS");
  });
});
