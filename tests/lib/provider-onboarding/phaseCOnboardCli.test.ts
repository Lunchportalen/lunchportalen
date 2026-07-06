import { describe, expect, it, vi } from "vitest";

import { PHASE_C_ONBOARD_CONFIRMATION_PHRASE, PHASE_C_REQUIRED_GLOBAL_TEMPLATES } from "@/lib/provider-onboarding/phaseCLocales";
import {
  buildCliInput,
  resolveSnapshotSource,
  runPhaseCOnboardCli,
} from "@/lib/provider-onboarding/phaseCOnboardCli";
import type { LiveReadSnapshotAdapters } from "@/lib/provider-onboarding/liveReadSnapshot";

const ENV_OK = {
  hasSupabaseServiceRole: true,
  hasSanityReadToken: true,
  hasSanityWriteToken: true,
  hasSuperadminCreds: true,
};

const DA_DK_ARGS = [
  "--dry-run",
  "--snapshot-source",
  "live",
  "--providerName",
  "Danish Lunch Pilot",
  "--providerSlug",
  "danish-lunch-pilot",
  "--locale",
  "da-DK",
  "--menuProfileId",
  "danish_office_lunch",
  "--country",
  "DK",
  "--currency",
  "DKK",
  "--timezone",
  "Europe/Copenhagen",
  "--adminEmail",
  "danish-lunch-pilot-admin@lunchportalen.no",
  "--safeFutureWeek",
  "2031-11-03",
];

function liveAdaptersWithTemplates(
  keys: string[] = [...PHASE_C_REQUIRED_GLOBAL_TEMPLATES],
): LiveReadSnapshotAdapters {
  return {
    listProviders: vi.fn(async () => [
      {
        id: "11111111-1111-1111-1111-111111111111",
        slug: "melhus-catering",
        name: "Melhus Catering AS",
      },
      {
        id: "a08e4742-c89d-48c5-a6a8-cf8532179083",
        slug: "swedish-lunch-pilot",
        name: "Swedish Lunch Pilot",
      },
    ]),
    listProviderSettingsLocales: vi.fn(async () => [
      { providerId: "11111111-1111-1111-1111-111111111111", locale: "nb-NO" },
      { providerId: "a08e4742-c89d-48c5-a6a8-cf8532179083", locale: "sv-SE" },
    ]),
    findExistingAdminEmails: vi.fn(async () => [
      "swedish-lunch-pilot-admin@lunchportalen.no",
    ]),
    listGlobalTemplateKeys: vi.fn(async () => keys),
    loadLocaleInventoryRows: vi.fn(async (globalOk) => [
      {
        locale: "da-DK",
        menuProfileId: "danish_office_lunch",
        country: "DK",
        currency: "DKK",
        timezone: "Europe/Copenhagen",
        providerExists: false,
        providerId: null,
        providerSlug: null,
        organizationMirrorExists: false,
        providerSettingsComplete: false,
        providerAdminAuthExists: false,
        providerMembershipExists: false,
        automationCredsAvailable: false,
        sanityProviderMirrorExists: false,
        providerRefResolves: false,
        globalSanityTemplatesOk: globalOk,
        providerScopedCatalogDocs: 0,
        existingFutureMenuDays: 0,
        latestApplyOrDryRunEvidence: null,
      },
    ]),
  };
}

describe("resolveSnapshotSource", () => {
  it("defaults dryRun to live", () => {
    expect(resolveSnapshotSource(["--dry-run", "--locale", "da-DK"], "dry_run")).toBe("live");
  });

  it("allows explicit fixture for tests", () => {
    expect(
      resolveSnapshotSource(
        ["--dry-run", "--snapshot-source", "fixture", "--locale", "da-DK"],
        "dry_run",
      ),
    ).toBe("fixture");
  });
});

describe("buildCliInput", () => {
  it("accepts camelCase operator flags", () => {
    const input = buildCliInput(DA_DK_ARGS);
    expect(input.providerName).toBe("Danish Lunch Pilot");
    expect(input.providerSlug).toBe("danish-lunch-pilot");
    expect(input.adminEmail).toBe("danish-lunch-pilot-admin@lunchportalen.no");
    expect(input.safeFutureWeek).toBe("2031-11-03");
    expect(input.mode).toBe("dry_run");
  });

  it("joins multi-word providerName tokens split by shells", () => {
    const input = buildCliInput([
      "--dry-run",
      "--locale",
      "da-DK",
      "--providerName",
      "Danish",
      "Lunch",
      "Pilot",
      "--providerSlug",
      "danish-lunch-pilot",
    ]);
    expect(input.providerName).toBe("Danish Lunch Pilot");
  });
});

describe("runPhaseCOnboardCli", () => {
  it("fixture snapshot dryRun works for da-DK", async () => {
    const result = await runPhaseCOnboardCli(
      ["--dry-run", "--snapshot-source", "fixture", "--locale", "da-DK"],
      { envPresence: ENV_OK },
    );
    expect(result.exitCode).toBe(0);
    expect(result.writes).toBe(0);
    expect(result.body.status).toBe("DRY_RUN_OK");
    expect(result.body.snapshotSource).toBe("fixture");
    expect(result.body.ok).toBe(true);
    expect(result.body.passwordPrinted).toBe(false);
  });

  it("live snapshot mocked returns PASS for da-DK when global templates exist", async () => {
    const adapters = liveAdaptersWithTemplates();
    const result = await runPhaseCOnboardCli(DA_DK_ARGS, {
      envPresence: ENV_OK,
      createLiveAdapters: () => adapters,
    });
    expect(result.exitCode).toBe(0);
    expect(result.body.status).toBe("DRY_RUN_OK");
    expect(result.body.snapshotSource).toBe("live");
    expect(result.body.ok).toBe(true);
    expect(result.body.blockers).toEqual([]);
    expect(result.body.globalTemplates).toBe("PASS");
    expect(result.body.slugConflict).toBe("none");
    expect(result.body.emailConflict).toBe("none");
    expect(result.body.localeClassificationBeforeOnboarding).toBe("BLOCKED_PROVIDER");
    expect(result.body.writePlanPresent).toBe(true);
    expect(result.body.rollbackPlanPresent).toBe(true);
    expect(result.body.passwordPrinted).toBe(false);
    expect(result.body.exactNextGoPrompt).toEqual(expect.stringContaining("ONBOARD_PROVIDER_APPLY"));
    expect(result.writes).toBe(0);
    expect(adapters.listProviders).toHaveBeenCalled();
    expect(adapters.listGlobalTemplateKeys).toHaveBeenCalled();
  });

  it("live snapshot missing global templates returns DRY_RUN_BLOCKED", async () => {
    const result = await runPhaseCOnboardCli(DA_DK_ARGS, {
      envPresence: ENV_OK,
      createLiveAdapters: () => liveAdaptersWithTemplates(["paasmurt"]),
    });
    expect(result.exitCode).toBe(1);
    expect(result.body.status).toBe("DRY_RUN_BLOCKED");
    expect(result.body.globalTemplates).toBe("FAIL");
    expect(
      (result.body.blockers as Array<{ code: string }>).some(
        (b) => b.code === "MISSING_GLOBAL_TEMPLATE",
      ),
    ).toBe(true);
  });

  it("dryRun never requires PHASE_C_ALLOW_LIVE_ONBOARD", async () => {
    const result = await runPhaseCOnboardCli(DA_DK_ARGS, {
      envPresence: ENV_OK,
      liveOnboardFlag: false,
      createLiveAdapters: () => liveAdaptersWithTemplates(),
    });
    expect(result.exitCode).toBe(0);
    expect(result.body.status).toBe("DRY_RUN_OK");
  });

  it("apply still requires ONBOARD_PROVIDER_APPLY", async () => {
    const result = await runPhaseCOnboardCli(
      ["--apply", "--snapshot-source", "fixture", "--locale", "da-DK"],
      { envPresence: ENV_OK, liveOnboardFlag: true, liveAdaptersEnabled: true },
    );
    expect(result.exitCode).toBe(1);
    expect(result.body.status).toBe("APPLY_BLOCKED");
    expect(result.writes).toBe(0);
  });

  it("apply still requires PHASE_C_ALLOW_LIVE_ONBOARD=1", async () => {
    const result = await runPhaseCOnboardCli(
      [
        "--apply",
        "--snapshot-source",
        "fixture",
        "--locale",
        "da-DK",
        "--confirm",
        PHASE_C_ONBOARD_CONFIRMATION_PHRASE,
      ],
      { envPresence: ENV_OK, liveOnboardFlag: false, liveAdaptersEnabled: true },
    );
    expect(result.exitCode).toBe(2);
    expect(result.body.status).toBe("APPLY_GATED");
    expect(result.writes).toBe(0);
  });

  it("secrets are redacted from JSON body", async () => {
    const result = await runPhaseCOnboardCli(DA_DK_ARGS, {
      envPresence: ENV_OK,
      createLiveAdapters: () => liveAdaptersWithTemplates(),
    });
    const json = JSON.stringify(result.body);
    expect(result.body.secretsRedacted).toBe(true);
    expect(result.body.passwordPrinted).toBe(false);
    expect(json).not.toMatch(/password\s*[:=]\s*["'][^"']+["']/i);
    expect(json).not.toContain("eyJ");
    expect(json).not.toMatch(/service.?role.?key/i);
  });

  it("does not silently use empty snapshot for production-like dryRun", async () => {
    await expect(
      runPhaseCOnboardCli(["--dry-run", "--locale", "da-DK"], { envPresence: ENV_OK }),
    ).rejects.toThrow(/Live snapshot source requires live adapters/);
  });

  it("protected Melhus cannot be targeted", async () => {
    const result = await runPhaseCOnboardCli(
      [
        "--dry-run",
        "--snapshot-source",
        "fixture",
        "--locale",
        "nb-NO",
        "--providerName",
        "Melhus Catering AS",
        "--providerSlug",
        "melhus-catering",
      ],
      { envPresence: ENV_OK },
    );
    expect(result.exitCode).toBe(1);
    expect(
      (result.body.blockers as Array<{ code: string }>).some(
        (b) => b.code === "PROTECTED_PROVIDER_MUTATION",
      ),
    ).toBe(true);
  });

  it("protected Swedish cannot be targeted", async () => {
    const result = await runPhaseCOnboardCli(
      [
        "--dry-run",
        "--snapshot-source",
        "fixture",
        "--locale",
        "sv-SE",
        "--providerName",
        "Swedish Lunch Pilot",
        "--providerSlug",
        "swedish-lunch-pilot",
      ],
      { envPresence: ENV_OK },
    );
    expect(result.exitCode).toBe(1);
    expect(
      (result.body.blockers as Array<{ code: string }>).some(
        (b) => b.code === "PROTECTED_PROVIDER_MUTATION",
      ),
    ).toBe(true);
  });

  it("apply refuses when execute signals passwordPrinted", async () => {
    const result = await runPhaseCOnboardCli(
      [
        "--apply",
        "--snapshot-source",
        "fixture",
        "--locale",
        "da-DK",
        "--confirm",
        PHASE_C_ONBOARD_CONFIRMATION_PHRASE,
      ],
      {
        envPresence: ENV_OK,
        liveOnboardFlag: true,
        liveAdaptersEnabled: true,
        createLiveWriteAdapters: () => ({}) as never,
        executeApply: async () => ({
          ok: true,
          providerId: "prov-1",
          stepsCompleted: ["create_provider"],
          writesPerformed: true,
          menuDaysCreated: 0,
          published: false,
          sotStarted: true,
          massExpansionStarted: true,
          passwordPrinted: true,
          message: "provider onboarded",
        }),
      },
    );
    expect(result.exitCode).toBe(2);
    expect(result.body.status).toBe("APPLY_GATED");
    expect(result.body.reasonCode).toBe("PASSWORD_PRINT_FORBIDDEN");
    expect(result.body.passwordPrinted).toBe(false);
    expect(result.writes).toBe(0);
    expect(JSON.stringify(result.body)).not.toMatch(/password\s*[:=]/i);
  });
});
