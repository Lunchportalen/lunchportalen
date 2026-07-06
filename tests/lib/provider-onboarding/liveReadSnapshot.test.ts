import { describe, expect, it, vi } from "vitest";

import { PHASE_C_REQUIRED_GLOBAL_TEMPLATES } from "@/lib/provider-onboarding/phaseCLocales";
import {
  buildFixturePreflightSnapshot,
  buildLiveReadPreflightSnapshot,
  type LiveReadSnapshotAdapters,
} from "@/lib/provider-onboarding/liveReadSnapshot";

const ENV_OK = {
  hasSupabaseServiceRole: true,
  hasSanityReadToken: true,
  hasSanityWriteToken: true,
  hasSuperadminCreds: true,
};

function adapters(partial: Partial<LiveReadSnapshotAdapters> = {}): LiveReadSnapshotAdapters {
  return {
    listProviders: vi.fn(async () => [
      {
        id: "11111111-1111-1111-1111-111111111111",
        slug: "melhus-catering",
        name: "Melhus Catering AS",
      },
    ]),
    listProviderSettingsLocales: vi.fn(async () => [
      { providerId: "11111111-1111-1111-1111-111111111111", locale: "nb-NO" },
    ]),
    findExistingAdminEmails: vi.fn(async () => [
      "swedish-lunch-pilot-admin@lunchportalen.no",
    ]),
    listGlobalTemplateKeys: vi.fn(async () => [...PHASE_C_REQUIRED_GLOBAL_TEMPLATES]),
    ...partial,
  };
}

describe("buildLiveReadPreflightSnapshot", () => {
  it("returns live PASS snapshot when global templates exist", async () => {
    const result = await buildLiveReadPreflightSnapshot({
      adapters: adapters(),
      envPresence: ENV_OK,
      candidateAdminEmails: ["danish-lunch-pilot-admin@lunchportalen.no"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.writes).toBe(0);
    expect(result.readOnly).toBe(true);
    expect(result.globalTemplatesOk).toBe(true);
    expect(result.missingGlobalTemplates).toEqual([]);
    expect(result.snapshot.globalTemplateKeys).toEqual([...PHASE_C_REQUIRED_GLOBAL_TEMPLATES]);
  });

  it("reports missing global templates", async () => {
    const result = await buildLiveReadPreflightSnapshot({
      adapters: adapters({
        listGlobalTemplateKeys: vi.fn(async () => ["paasmurt", "salatboks"]),
      }),
      envPresence: ENV_OK,
      candidateAdminEmails: ["danish-lunch-pilot-admin@lunchportalen.no"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.globalTemplatesOk).toBe(false);
    expect(result.missingGlobalTemplates).toContain("varmrett");
  });

  it("blocks when read env presence incomplete", async () => {
    const result = await buildLiveReadPreflightSnapshot({
      adapters: adapters(),
      envPresence: {
        hasSupabaseServiceRole: false,
        hasSanityReadToken: true,
        hasSanityWriteToken: true,
        hasSuperadminCreds: true,
      },
      candidateAdminEmails: ["danish-lunch-pilot-admin@lunchportalen.no"],
    });
    expect(result.ok).toBe(false);
    if (result.ok !== false) return;
    expect(result.error.code).toBe("LIVE_READ_MISSING_ENV");
    expect(result.writes).toBe(0);
  });

  it("never invokes write-shaped methods (adapters are read-only)", async () => {
    const a = adapters();
    await buildLiveReadPreflightSnapshot({
      adapters: a,
      envPresence: ENV_OK,
      candidateAdminEmails: ["danish-lunch-pilot-admin@lunchportalen.no"],
    });
    expect(a.listProviders).toHaveBeenCalledTimes(1);
    expect(a.listGlobalTemplateKeys).toHaveBeenCalledTimes(1);
    expect(Object.keys(a).every((k) => !k.toLowerCase().includes("write"))).toBe(true);
  });
});

describe("buildFixturePreflightSnapshot", () => {
  it("includes protected providers and full template set for tests", () => {
    const snapshot = buildFixturePreflightSnapshot(ENV_OK);
    expect(snapshot.globalTemplateKeys).toEqual([...PHASE_C_REQUIRED_GLOBAL_TEMPLATES]);
    expect(snapshot.existingProviders.some((p) => p.slug === "melhus-catering")).toBe(true);
  });
});
