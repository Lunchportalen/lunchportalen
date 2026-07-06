import { describe, expect, it } from "vitest";

import {
  alignLiveReadSanityDataset,
  classifySupabaseEnv,
  evaluateInventoryProviderMirror,
  resolveLiveReadClientEnv,
} from "@/lib/provider-onboarding/createLiveReadAdapters";

const PROD_URL = "https://hkpokyapzarefrgqzkos.supabase.co";
const STAGING_URL = "https://uigxsboqeruxflgzqztl.supabase.co";

describe("classifySupabaseEnv", () => {
  it("detects production Supabase project", () => {
    expect(classifySupabaseEnv(PROD_URL)).toBe("production");
  });

  it("marks other hosts non_production", () => {
    expect(classifySupabaseEnv(STAGING_URL)).toBe("non_production");
  });
});

describe("alignLiveReadSanityDataset", () => {
  it("aligns staging Sanity dataset to production when Supabase is production", () => {
    const aligned = alignLiveReadSanityDataset({
      supabaseUrl: PROD_URL,
      sanityDataset: "staging",
    });
    expect(aligned.sanityDataset).toBe("production");
    expect(aligned.meta.datasetAlignedToProduction).toBe(true);
    expect(aligned.meta.supabaseEnvClass).toBe("production");
  });

  it("keeps production dataset unchanged", () => {
    const aligned = alignLiveReadSanityDataset({
      supabaseUrl: PROD_URL,
      sanityDataset: "production",
    });
    expect(aligned.sanityDataset).toBe("production");
    expect(aligned.meta.datasetAlignedToProduction).toBe(false);
  });

  it("does not force-production for non-production Supabase", () => {
    const aligned = alignLiveReadSanityDataset({
      supabaseUrl: STAGING_URL,
      sanityDataset: "staging",
    });
    expect(aligned.sanityDataset).toBe("staging");
    expect(aligned.meta.datasetAlignedToProduction).toBe(false);
  });
});

describe("resolveLiveReadClientEnv", () => {
  it("pairs production Supabase with production Sanity dataset", () => {
    const cfg = resolveLiveReadClientEnv({
      NEXT_PUBLIC_SUPABASE_URL: PROD_URL,
      NEXT_PUBLIC_SANITY_DATASET: "staging",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "demo",
      SANITY_READ_TOKEN: "token",
    });
    expect(cfg.sanityDataset).toBe("production");
    expect(cfg.meta.datasetAlignedToProduction).toBe(true);
  });
});

describe("evaluateInventoryProviderMirror", () => {
  it("maps matching id/slug like PR #430 preflight", () => {
    const flags = evaluateInventoryProviderMirror({
      providerId: "a08e4742-c89d-48c5-a6a8-cf8532179083",
      providerSlug: "swedish-lunch-pilot",
      mirror: {
        sanityId: "a08e4742-c89d-48c5-a6a8-cf8532179083",
        name: "Swedish Lunch Pilot",
        slug: "swedish-lunch-pilot",
      },
    });
    expect(flags.sanityProviderMirrorExists).toBe(true);
    expect(flags.providerRefResolves).toBe(true);
  });

  it("normalizes slug case/whitespace when matching", () => {
    const flags = evaluateInventoryProviderMirror({
      providerId: "a08e4742-c89d-48c5-a6a8-cf8532179083",
      providerSlug: "Swedish-Lunch-Pilot",
      mirror: {
        sanityId: "a08e4742-c89d-48c5-a6a8-cf8532179083",
        name: "Swedish Lunch Pilot",
        slug: " swedish-lunch-pilot ",
      },
    });
    expect(flags.providerRefResolves).toBe(true);
  });

  it("missing mirror does not resolve", () => {
    const flags = evaluateInventoryProviderMirror({
      providerId: "a08e4742-c89d-48c5-a6a8-cf8532179083",
      providerSlug: "swedish-lunch-pilot",
      mirror: null,
    });
    expect(flags.sanityProviderMirrorExists).toBe(false);
    expect(flags.providerRefResolves).toBe(false);
  });

  it("slug mismatch does not resolve", () => {
    const flags = evaluateInventoryProviderMirror({
      providerId: "a08e4742-c89d-48c5-a6a8-cf8532179083",
      providerSlug: "swedish-lunch-pilot",
      mirror: {
        sanityId: "a08e4742-c89d-48c5-a6a8-cf8532179083",
        name: "Swedish Lunch Pilot",
        slug: "other-slug",
      },
    });
    expect(flags.sanityProviderMirrorExists).toBe(true);
    expect(flags.providerRefResolves).toBe(false);
  });
});
