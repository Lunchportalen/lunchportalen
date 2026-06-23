import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import { TRIPLETEX_ACTIVITY_ACTION_KEYS } from "@/lib/integrations/tripletex/tripletexStatusPresentation";

const STATUS_ACTIONS = join(process.cwd(), "app/leverandor/innstillinger/tripletex/status/actions.ts");
const CONNECT_ACTIONS = join(process.cwd(), "app/leverandor/innstillinger/tripletex/koble-til/actions.ts");

describe("provider.tripletex i18n wiring (PR 7)", () => {
  it("nb/en define core tripletex namespaces", async () => {
    for (const locale of ["nb", "en"] as const) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: {
          tripletex: {
            page: { status: { heading: string }; connect: { heading: string } };
            state: Record<string, string>;
            activity: Record<string, string>;
            wizard: { heading: string; steps: { token: { title: string } } };
          };
        };
      };
      expect(messages.provider.tripletex.page.status.heading).toBeTruthy();
      expect(messages.provider.tripletex.page.connect.heading).toBeTruthy();
      expect(messages.provider.tripletex.wizard.heading).toBeTruthy();
      expect(messages.provider.tripletex.wizard.steps.token.title).toBeTruthy();
      expect(messages.provider.tripletex.state.CONNECTED).toBeTruthy();
      for (const activityKey of Object.values(TRIPLETEX_ACTIVITY_ACTION_KEYS)) {
        expect(messages.provider.tripletex.activity[activityKey]).toBeTruthy();
      }
    }
  });

  it("tripletex action contracts unchanged", () => {
    const statusSrc = readFileSync(STATUS_ACTIONS, "utf8");
    const connectSrc = readFileSync(CONNECT_ACTIONS, "utf8");
    expect(statusSrc).toContain("getDashboardDataAction");
    expect(statusSrc).toContain("testConnectionAction");
    expect(statusSrc).toContain("disconnectTripletexAction");
    expect(connectSrc).toContain("verifyTokenAction");
    expect(connectSrc).toContain("completeConnectionAction");
    expect(connectSrc).not.toContain("errorKey");
  });

  it("components use i18n not raw Norwegian chrome strings", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "components/provider/tripletex-status/StatusDashboardClient.tsx"),
      "utf8",
    );
    expect(dashboard).toContain('useTranslations("provider.tripletex.status.sections")');
    expect(dashboard).not.toContain("Ressurser i Tripletex");

    const wizard = readFileSync(join(process.cwd(), "components/provider/tripletex-wizard/DirectWizard.tsx"), "utf8");
    expect(wizard).toContain('useTranslations("provider.tripletex.wizard")');
    expect(wizard).not.toContain("Koble til Tripletex");
  });
});
