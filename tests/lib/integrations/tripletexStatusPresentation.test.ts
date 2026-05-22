import { describe, expect, test } from "vitest";

import {
  formatTripletexRelative,
  tripletexActivityLabel,
  tripletexConnectionStateLabel,
} from "@/lib/integrations/tripletex/tripletexStatusPresentation";

describe("tripletexStatusPresentation (TPT-B-7c)", () => {
  test("connection state labels in Norwegian", () => {
    expect(tripletexConnectionStateLabel("CONNECTED")).toBe("Tilkoblet");
    expect(tripletexConnectionStateLabel("CONFIGURING")).toBe("Konfigurerer…");
    expect(tripletexConnectionStateLabel("DEGRADED")).toBe("Trenger oppmerksomhet");
  });

  test("activity labels for known audit actions", () => {
    expect(tripletexActivityLabel("tripletex_onboarding_finalized")).toBe("Tilkobling fullført");
    expect(tripletexActivityLabel("tripletex_onboarding_test_token")).toBe("Tilkobling testet");
  });

  test("connection_state_change uses metadata new_state", () => {
    expect(
      tripletexActivityLabel("tripletex_connection_state_change", { new_state: "DISCONNECTED" }),
    ).toBe("Status endret til frakoblet");
  });

  test("formatTripletexRelative returns human-readable nb", () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatTripletexRelative(recent)).toMatch(/min siden/);
    expect(formatTripletexRelative(null)).toBe("—");
  });
});
