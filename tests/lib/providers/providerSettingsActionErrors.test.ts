import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ZodIssue } from "zod";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  PROVIDER_COVERAGE_ACTION_ERROR_KEYS,
  coverageActionFailure,
  mapServiceAreaRpcErrorKey,
  mapServiceAreaZodErrorKey,
  resolveProviderCoverageActionError,
} from "@/lib/providers/providerCoverageActionErrors";
import {
  PROVIDER_SETTINGS_BRAND_ERROR_KEYS,
  PROVIDER_SETTINGS_LOGO_ERROR_KEYS,
  PROVIDER_SETTINGS_OPERATIONS_ERROR_KEYS,
  PROVIDER_SETTINGS_PROFILE_ERROR_KEYS,
  mapOperationalEmailErrorKey,
  resolveProviderSettingsBrandError,
  resolveProviderSettingsLogoError,
  resolveProviderSettingsOperationsError,
  resolveProviderSettingsProfileError,
  settingsLogoFailure,
  settingsProfileFailure,
} from "@/lib/providers/providerSettingsActionErrors";

const COVERAGE_ACTIONS = join(process.cwd(), "app/leverandor/omrader/actions.ts");
const SETTINGS_FORM = join(process.cwd(), "components/providers/ProviderSettingsForm.tsx");
const OPS_FORM = join(process.cwd(), "components/providers/ProviderOperationsForm.tsx");
const LOGO = join(process.cwd(), "components/providers/ProviderLogoUploader.tsx");
const BRAND = join(process.cwd(), "components/providers/ProviderBrandColor.tsx");
const SERVICE_AREA_EDITOR = join(process.cwd(), "components/providers/ServiceAreaEditor.tsx");
const SERVICE_AREAS_MANAGER = join(process.cwd(), "components/providers/ServiceAreasManager.tsx");

describe("providerCoverageActionErrors", () => {
  it("coverageActionFailure returns stable errorKey", () => {
    expect(coverageActionFailure("serviceAreaNotFound")).toEqual({
      success: false,
      errorKey: "serviceAreaNotFound",
    });
  });

  it("mapServiceAreaRpcErrorKey maps RPC codes without raw message", () => {
    expect(mapServiceAreaRpcErrorKey("POSTAL_CODE_FORMAT_INVALID")).toBe("invalidPostalCode");
    expect(mapServiceAreaRpcErrorKey("POSTAL_RANGE_OVERLAPS_EXISTING:Oslo:0001-0100")).toBe("postalOverlap");
    expect(mapServiceAreaRpcErrorKey("SERVICE_AREA_NOT_FOUND")).toBe("serviceAreaNotFound");
  });

  it("mapServiceAreaZodErrorKey maps validation paths", () => {
    expect(mapServiceAreaZodErrorKey({ code: "too_small", path: ["city"], message: "" } as ZodIssue)).toBe(
      "cityRequired",
    );
    expect(
      mapServiceAreaZodErrorKey({ code: "custom", path: ["postal_code_to"], message: "range" } as ZodIssue),
    ).toBe("invalidPostalRange");
  });

  it("resolveProviderCoverageActionError translates known key and safe fallback", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { coverage: { errors: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.coverage.errors[key] ?? key;
    expect(
      resolveProviderCoverageActionError(t, { success: false, errorKey: "postalOverlap" }, "saveFailed"),
    ).toBe("Postnummer-intervallet overlapper et eksisterende aktivt område.");
    expect(resolveProviderCoverageActionError(t, { success: false }, "toggleFailed")).toBe(
      "Kunne ikke oppdatere status.",
    );
  });

  it("nb/en define all coverage action error keys", async () => {
    for (const locale of ["nb", "en"] as const) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { coverage: { errors: Record<string, string> } };
      };
      for (const key of PROVIDER_COVERAGE_ACTION_ERROR_KEYS) {
        expect(messages.provider.coverage.errors[key]).toBeTruthy();
      }
    }
  });
});

describe("providerSettingsActionErrors", () => {
  it("settingsProfileFailure returns stable errorKey", () => {
    expect(settingsProfileFailure("emailRequired")).toEqual({ ok: false, errorKey: "emailRequired" });
  });

  it("settingsLogoFailure returns stable errorKey", () => {
    expect(settingsLogoFailure("fileTooLarge")).toEqual({ ok: false, errorKey: "fileTooLarge" });
  });

  it("mapOperationalEmailErrorKey maps known validation messages", () => {
    expect(mapOperationalEmailErrorKey("Ugyldig e-postadresse.")).toBe("invalidEmail");
    expect(mapOperationalEmailErrorKey("E-postadressen er for lang.")).toBe("emailTooLong");
  });

  it("resolve settings errors never leak raw server strings", async () => {
    const nb = (await loadMessagesForLocale("nb")) as {
      provider: {
        settings: {
          profile: { errors: Record<string, string> };
          operations: { errors: Record<string, string> };
          logo: { errors: Record<string, string> };
          brand: { errors: Record<string, string> };
        };
      };
    };
    expect(
      resolveProviderSettingsProfileError(
        (key) => nb.provider.settings.profile.errors[key],
        { ok: false, errorKey: "nameRequired" },
      ),
    ).toBe("Navn er påkrevd.");
    expect(
      resolveProviderSettingsOperationsError(
        (key) => nb.provider.settings.operations.errors[key],
        { ok: false, errorKey: "invalidLocale" },
      ),
    ).toBe("Ugyldig språkvalg.");
    expect(
      resolveProviderSettingsLogoError(
        (key) => nb.provider.settings.logo.errors[key],
        { ok: false, errorKey: "unsupportedFileType" },
        "uploadFailed",
      ),
    ).toContain("PNG eller WebP");
    expect(
      resolveProviderSettingsBrandError(
        (key) => nb.provider.settings.brand.errors[key],
        { ok: false, errorKey: "contrastTooWeak" },
      ),
    ).toContain("kontrast");
    expect(
      resolveProviderSettingsProfileError((key) => nb.provider.settings.profile.errors[key], {
        ok: false,
        errorKey: "RAW_SERVER",
      }),
    ).toBe("Kunne ikke lagre innstillinger.");
  });

  it("nb/en define all settings error keys", async () => {
    for (const locale of ["nb", "en"] as const) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: {
          settings: {
            profile: { errors: Record<string, string> };
            operations: { errors: Record<string, string> };
            logo: { errors: Record<string, string> };
            brand: { errors: Record<string, string> };
          };
        };
      };
      for (const key of PROVIDER_SETTINGS_PROFILE_ERROR_KEYS) {
        expect(messages.provider.settings.profile.errors[key]).toBeTruthy();
      }
      for (const key of PROVIDER_SETTINGS_OPERATIONS_ERROR_KEYS) {
        expect(messages.provider.settings.operations.errors[key]).toBeTruthy();
      }
      for (const key of PROVIDER_SETTINGS_LOGO_ERROR_KEYS) {
        expect(messages.provider.settings.logo.errors[key]).toBeTruthy();
      }
      for (const key of PROVIDER_SETTINGS_BRAND_ERROR_KEYS) {
        expect(messages.provider.settings.brand.errors[key]).toBeTruthy();
      }
    }
  });
});

describe("PR 5b wiring and payload locks", () => {
  it("coverage actions return errorKey-only failures", () => {
    const src = readFileSync(COVERAGE_ACTIONS, "utf8");
    expect(src).toContain("errorKey: ProviderCoverageActionErrorKey");
    expect(src).not.toContain('error: "Ikke innlogget."');
    expect(src).toContain("coverageActionFailure");
  });

  it("coverage/settings components resolve errorKey via i18n", () => {
    expect(readFileSync(SERVICE_AREAS_MANAGER, "utf8")).toContain("resolveProviderCoverageActionError");
    expect(readFileSync(SERVICE_AREAS_MANAGER, "utf8")).toContain('useTranslations("provider.coverage.errors")');
    expect(readFileSync(SERVICE_AREA_EDITOR, "utf8")).not.toContain("res.error");
    expect(readFileSync(SETTINGS_FORM, "utf8")).toContain("resolveProviderSettingsProfileError");
    expect(readFileSync(OPS_FORM, "utf8")).toContain("resolveProviderSettingsOperationsError");
    expect(readFileSync(LOGO, "utf8")).toContain("resolveProviderSettingsLogoError");
    expect(readFileSync(BRAND, "utf8")).toContain("resolveProviderSettingsBrandError");
  });

  it("submit payloads remain unchanged", () => {
    const editor = readFileSync(SERVICE_AREA_EDITOR, "utf8");
    expect(editor).toContain("postal_code_from: normalizePostal(form.postal_code_from)");
    expect(editor).toContain("available_days: form.available_days");

    const settings = readFileSync(SETTINGS_FORM, "utf8");
    expect(settings).toContain('name: String(fd.get("name")');
    expect(settings).toContain('contactEmail: String(fd.get("contactEmail")');

    const ops = readFileSync(OPS_FORM, "utf8");
    expect(ops).toContain("operationsEmail:");
    expect(ops).toContain('locale: String(fd.get("locale")');

    const logo = readFileSync(LOGO, "utf8");
    expect(logo).toContain('accept={ACCEPT}');
    expect(logo).toContain("MAX_LOGO_BYTES = 2 * 1024 * 1024");
    expect(logo).toContain('fd.set("file", file)');
  });
});
