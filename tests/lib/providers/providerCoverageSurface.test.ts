import { describe, expect, it } from "vitest";

import {
  PROVIDER_COVERAGE_EMPTY_STEP_KEYS,
  coverageStatusKey,
  coverageStatusLabel,
  formatCoverageDays,
  formatCoverageEmployees,
  providerCoverageSubheading,
  providerCoverageSummary,
} from "@/lib/providers/providerCoverageSurface";
import { loadMessagesForLocale } from "@/lib/i18n/messages";

type CoverageMessages = {
  provider: {
    coverage: {
      page: { heading: string; leadWithProvider: string };
      actions: { newArea: string; deactivate: string; deactivateTitle: string };
      table: Record<string, string>;
      empty: Record<string, string>;
      summary: Record<string, string>;
      status: Record<string, string>;
      weekdays: Record<string, string>;
      format: Record<string, string>;
    };
  };
};

function coverageMessages(messages: Awaited<ReturnType<typeof loadMessagesForLocale>>) {
  return messages as CoverageMessages;
}

function tNb(messages: CoverageMessages["provider"]["coverage"]) {
  return (key: string, values?: Record<string, string | number>) => {
    const parts = key.split(".");
    let cur: unknown = messages;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as object)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return key;
      }
    }
    let out = String(cur ?? key);
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        out = out.replace(`{${k}}`, String(v));
      }
    }
    return out;
  };
}

describe("provider.coverage messages — enterprise copy", () => {
  it("CTA er «Nytt dekningsområde», ikke «Legg til område»", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.coverage.actions.newArea).toBe("Nytt dekningsområde");
    expect(messages.provider.coverage.actions.newArea).not.toBe("Legg til område");
  });

  it("kolonner bruker tydelige labels", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.coverage.table.area).toBe("Område");
    expect(messages.provider.coverage.table.postalCodes).toBe("Postnummer");
    expect(messages.provider.coverage.table.minEmployees).toBe("Min. ansatte");
    expect(messages.provider.coverage.table.deliveryDays).toBe("Leveringsdager");
    expect(messages.provider.coverage.table.status).toBe("Status");
  });

  it("deaktiver-copy forklarer konsekvens uten å overlove", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.coverage.actions.deactivate).toBe("Deaktiver");
    expect(messages.provider.coverage.actions.deactivateTitle).toContain("Nye bedrifter");
    expect(messages.provider.coverage.actions.deactivateTitle).toContain(
      "Eksisterende avtaler endres ikke automatisk.",
    );
  });

  it("subheading forklarer operasjonell konsekvens", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    const t = tNb(messages.provider.coverage);
    const s = providerCoverageSubheading("Melhus Catering AS", t);
    expect(s).toContain("hvilke bedrifter som kan sende forespørsel til Melhus Catering AS");
    expect(s).toContain("postnummer, minimum antall ansatte og leveringsdager");
  });
});

describe("providerCoverageSummary", () => {
  it("0 / 1 / flere aktive områder", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    const t = tNb(messages.provider.coverage);
    expect(providerCoverageSummary([], t)).toBe("Ingen aktive dekningsområder");
    expect(providerCoverageSummary([{ active: true }], t)).toBe("1 aktivt dekningsområde");
    expect(providerCoverageSummary([{ active: true }, { active: true }, { active: true }], t)).toBe(
      "3 aktive dekningsområder",
    );
  });

  it("inaktive telles som suffiks", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    const t = tNb(messages.provider.coverage);
    expect(providerCoverageSummary([{ active: true }, { active: false }], t)).toBe(
      "1 aktivt dekningsområde · 1 inaktive",
    );
    expect(providerCoverageSummary([{ active: false }], t)).toBe("Ingen aktive dekningsområder · 1 inaktive");
  });
});

describe("coverageStatusLabel", () => {
  it("mapper boolean og kjente statuser til provider-safe copy", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    const t = tNb(messages.provider.coverage);
    expect(coverageStatusLabel(true, t)).toBe("Aktiv");
    expect(coverageStatusLabel(false, t)).toBe("Inaktiv");
    expect(coverageStatusLabel("ACTIVE", t)).toBe("Aktiv");
    expect(coverageStatusLabel("inactive", t)).toBe("Inaktiv");
    expect(coverageStatusLabel("PAUSED", t)).toBe("Pauset");
  });

  it("fallback lekker aldri rå enum", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    const t = tNb(messages.provider.coverage);
    expect(coverageStatusLabel("SOME_RAW_ENUM", t)).toBe("Ukjent");
    expect(coverageStatusLabel(null, t)).toBe("Ukjent");
    expect(coverageStatusLabel("", t)).toBe("Ukjent");
  });

  it("coverageStatusKey returnerer stabile ids", () => {
    expect(coverageStatusKey(true)).toBe("active");
    expect(coverageStatusKey("PAUSED")).toBe("paused");
    expect(coverageStatusKey("UNKNOWN")).toBe("unknown");
  });
});

describe("formatCoverageDays", () => {
  it("alle hverdager vises som «Mandag–fredag»", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    const t = tNb(messages.provider.coverage);
    expect(formatCoverageDays(["mon", "tue", "wed", "thu", "fri"], t)).toBe("Mandag–fredag");
  });

  it("delvise dager bruker UI-labels, ikke rå verdier", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    const t = tNb(messages.provider.coverage);
    expect(formatCoverageDays(["mon", "wed", "fri"], t)).toBe("Man, Ons, Fre");
    expect(formatCoverageDays(["MON", "wed"], t)).toBe("Man, Ons");
  });

  it("ukjente/tomme verdier gir em-dash, aldri rå databaseverdi", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    const t = tNb(messages.provider.coverage);
    expect(formatCoverageDays([], t)).toBe("—");
    expect(formatCoverageDays(["funday"], t)).toBe("—");
  });
});

describe("formatCoverageEmployees", () => {
  it("min/max-varianter", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    const t = tNb(messages.provider.coverage);
    expect(formatCoverageEmployees(20, 50, t)).toBe("20–50");
    expect(formatCoverageEmployees(20, null, t)).toBe("20+");
    expect(formatCoverageEmployees(null, 50, t)).toBe("≤50");
    expect(formatCoverageEmployees(null, null, t)).toBe("—");
  });
});

describe("PROVIDER_COVERAGE_EMPTY_STEP_KEYS", () => {
  it("operasjonell empty state med micro-guidance", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    const empty = messages.provider.coverage.empty;
    expect(empty.title).toBe("Ingen dekningsområder ennå");
    expect(empty.text).toContain("styre hvilke bedrifter");
    expect(PROVIDER_COVERAGE_EMPTY_STEP_KEYS.map((k) => empty[k])).toEqual([
      "Definer postnummer eller område.",
      "Sett minimum antall ansatte.",
      "Velg leveringsdager for området.",
    ]);
  });

  it("ingen teknisk copy", async () => {
    const messages = coverageMessages(await loadMessagesForLocale("nb"));
    const all = JSON.stringify(messages.provider.coverage.empty).toLowerCase();
    expect(all).not.toMatch(/null|enum|provider_service_areas|active=/);
  });
});

describe("coverage/settings i18n wiring", () => {
  it("ServiceAreasManager bruker provider.coverage", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("components/providers/ServiceAreasManager.tsx", "utf8");
    expect(src).toContain('useTranslations("provider.coverage")');
    expect(src).not.toContain("PROVIDER_COVERAGE_COPY");
  });

  it("ServiceAreaEditor bruker provider.coverage", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("components/providers/ServiceAreaEditor.tsx", "utf8");
    expect(src).toContain('useTranslations("provider.coverage")');
    expect(src).not.toContain("WEEKDAY_LABELS");
  });

  it("settings forms bruker provider.settings.*", async () => {
    const { readFileSync } = await import("fs");
    expect(readFileSync("components/providers/ProviderSettingsForm.tsx", "utf8")).toContain(
      'useTranslations("provider.settings.profile")',
    );
    expect(readFileSync("components/providers/ProviderOperationsForm.tsx", "utf8")).toContain(
      'useTranslations("provider.settings.operations")',
    );
    expect(readFileSync("components/providers/ProviderLogoUploader.tsx", "utf8")).toContain(
      'useTranslations("provider.settings.logo")',
    );
    expect(readFileSync("components/providers/ProviderBrandColor.tsx", "utf8")).toContain(
      'useTranslations("provider.settings.brand")',
    );
  });

  it("SuspendedBanner bruker provider.banner", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("components/providers/SuspendedBanner.tsx", "utf8");
    expect(src).toContain('getTranslations("provider.banner")');
  });

  it("save payloads er uendret i settings forms", async () => {
    const { readFileSync } = await import("fs");
    const settings = readFileSync("components/providers/ProviderSettingsForm.tsx", "utf8");
    expect(settings).toContain("providerId: provider.id");
    expect(settings).toContain('name: String(fd.get("name")');
    expect(settings).toContain('contactEmail: String(fd.get("contactEmail")');
    expect(settings).toContain('contactPhone: String(fd.get("contactPhone")');

    const ops = readFileSync("components/providers/ProviderOperationsForm.tsx", "utf8");
    expect(ops).toContain("operationsEmail:");
    expect(ops).toContain("kitchenEmail:");
    expect(ops).toContain("deliveryEmail:");
    expect(ops).toContain('locale: String(fd.get("locale")');
  });

  it("ServiceAreaEditor submit payload er uendret", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("components/providers/ServiceAreaEditor.tsx", "utf8");
    expect(src).toContain("postal_code_from: normalizePostal(form.postal_code_from)");
    expect(src).toContain("available_days: form.available_days");
    expect(src).toContain("active: form.active");
  });

  it("nb/en har coverage og settings keys", async () => {
    const nb = (await loadMessagesForLocale("nb")) as {
      provider: { coverage: { page: { heading: string } }; settings: { page: { heading: string } } };
    };
    const en = (await loadMessagesForLocale("en")) as {
      provider: { coverage: { page: { heading: string } }; settings: { page: { heading: string } } };
    };
    expect(nb.provider.coverage.page.heading).toBeTruthy();
    expect(en.provider.coverage.page.heading).toBeTruthy();
    expect(nb.provider.settings.page.heading).toBe("Innstillinger");
    expect(en.provider.settings.page.heading).toBe("Settings");
  });
});
