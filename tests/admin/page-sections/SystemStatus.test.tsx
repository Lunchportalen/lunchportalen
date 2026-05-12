// @ts-nocheck
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { formatAgreementSystemLabel, formatSystemPaymentLabel } from "@/lib/admin/agreementLabel";
import SystemStatus from "@/app/admin/page-sections/SystemStatus";
import type { AgreementStatusResult } from "@/lib/auth/agreementStatus";

globalThis.React = React;

function status(overrides: Partial<AgreementStatusResult>): AgreementStatusResult {
  return {
    agreementId: "ag_1",
    tier: "BASIS",
    dayTiers: {
      mon: "BASIS",
      tue: "BASIS",
      wed: "BASIS",
      thu: "BASIS",
      fri: "BASIS",
    },
    status: "ACTIVE",
    isActive: true,
    billingHold: false,
    ...overrides,
  };
}

describe("SystemStatus agreement labels", () => {
  test("uniform tier ACTIVE", () => {
    expect(formatAgreementSystemLabel(status({}))).toBe("Basis · Aktiv");
  });

  test("blandet tier 3-2", () => {
    expect(
      formatAgreementSystemLabel(
        status({
          dayTiers: {
            mon: "BASIS",
            tue: "BASIS",
            wed: "LUXUS",
            thu: "BASIS",
            fri: "LUXUS",
          },
        }),
      ),
    ).toBe("Blandet (3 dager Basis, 2 dager Luxus) · Aktiv");
  });

  test("blandet tier med ENTERPRISE", () => {
    expect(
      formatAgreementSystemLabel(
        status({
          dayTiers: {
            mon: "BASIS",
            tue: "BASIS",
            wed: "LUXUS",
            thu: "ENTERPRISE",
            fri: "ENTERPRISE",
          },
        }),
      ),
    ).toBe("Blandet (2 dager Basis, 1 dag Luxus, 2 dager Enterprise) · Aktiv");
  });

  test("ingen aktiv", () => {
    expect(formatAgreementSystemLabel(status({ agreementId: null, tier: null, status: null, isActive: false }))).toBe(
      "Ingen aktiv",
    );
  });

  test("PAUSED status", () => {
    expect(formatAgreementSystemLabel(status({ status: "PAUSED", isActive: false }))).toBe("Basis · Pauset");
  });

  test("payment-rad viser 'Ikke aktivert'", () => {
    expect(formatSystemPaymentLabel()).toBe("Ikke aktivert");
    const html = renderToStaticMarkup(
      <SystemStatus data={[{ label: "Betaling", value: formatSystemPaymentLabel(), kind: "neutral" }]} />,
    );

    expect(html).toContain("Betaling");
    expect(html).toContain("Ikke aktivert");
    expect(html).toContain("is-neutral");
  });

  test("ent dag i blandingen får entall 'dag' istedenfor 'dager'", () => {
    const label = formatAgreementSystemLabel(
      status({
        dayTiers: {
          mon: "BASIS",
          tue: "BASIS",
          wed: "BASIS",
          thu: "BASIS",
          fri: "LUXUS",
        },
      }),
    );

    expect(label).toContain("1 dag Luxus");
    expect(label).not.toContain("1 dager Luxus");
  });
});
