import { describe, expect, test } from "vitest";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  TRIPLETEX_CONNECTION_STATES,
  formatTripletexRelative,
  resolveTripletexActivityLabel,
  resolveTripletexConnectionStateLabel,
} from "@/lib/integrations/tripletex/tripletexStatusPresentation";

describe("tripletexStatusPresentation (TPT-B-7c i18n)", () => {
  test("connection state labels resolve via nb messages", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { tripletex: { state: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.tripletex.state[key] ?? key;
    expect(resolveTripletexConnectionStateLabel(t, "CONNECTED")).toBe("Tilkoblet");
    expect(resolveTripletexConnectionStateLabel(t, "CONFIGURING")).toBe("Konfigurerer…");
    expect(resolveTripletexConnectionStateLabel(t, "DEGRADED")).toBe("Trenger oppmerksomhet");
  });

  test("activity labels resolve for known audit actions", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { tripletex: { activity: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.tripletex.activity[key] ?? key;
    expect(resolveTripletexActivityLabel(t, "tripletex_onboarding_finalized")).toBe("Tilkobling fullført");
    expect(resolveTripletexActivityLabel(t, "tripletex_onboarding_test_token")).toBe("Tilkobling testet");
  });

  test("connection_state_change uses metadata new_state", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { tripletex: { activity: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.tripletex.activity[key] ?? key;
    expect(
      resolveTripletexActivityLabel(t, "tripletex_connection_state_change", { new_state: "DISCONNECTED" }),
    ).toBe("Status endret til frakoblet");
  });

  test("formatTripletexRelative uses locale-aware output", () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatTripletexRelative(recent, "nb")).toBeTruthy();
    expect(formatTripletexRelative(recent, "en")).toBeTruthy();
    expect(formatTripletexRelative(null, "nb", "—")).toBe("—");
  });

  test("nb/en define all connection state keys", async () => {
    for (const locale of ["nb", "en"] as const) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { tripletex: { state: Record<string, string> } };
      };
      for (const key of TRIPLETEX_CONNECTION_STATES) {
        expect(messages.provider.tripletex.state[key]).toBeTruthy();
      }
    }
  });
});
