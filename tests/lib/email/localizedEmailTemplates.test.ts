/**
 * Fase E5 (GLOBAL RELEASE GATE): localized transactional emails for all 9 app locales.
 * - Every locale renders complete subject/body (no raw keys, no missing strings)
 * - nb output preserves canonical Norwegian copy (no drift)
 * - unknown locale falls back to nb (fail-closed)
 */
import { describe, test, expect } from "vitest";

import { APP_LOCALES } from "@/lib/i18n/middlewareLocale";
import { buildEmployeeInviteEmail } from "@/lib/email/templates/employeeInvite";
import { buildPasswordResetEmail } from "@/lib/email/passwordResetMail";
import { employeeInviteCopy, passwordResetCopy } from "@/lib/email/i18n/emailCopy";

const RAW_KEY_PATTERN = /[a-z]+\.[a-z]+\.[a-z]+/; // i18n-style dotted keys
const MOJIBAKE = /Ã|Â|â€/;

describe("employee invite email — all locales", () => {
  for (const locale of APP_LOCALES) {
    test(`${locale}: complete, localized, no raw keys or mojibake`, () => {
      const built = buildEmployeeInviteEmail({
        companyName: "Acme AS",
        inviteUrl: "https://app.lunchportalen.no/invite/abc",
        providerName: "Melhus Catering",
        locationName: "Hovedkontor",
        locale,
      });

      expect(built.subject).toContain("Acme AS");
      expect(built.html).toContain("https://app.lunchportalen.no/invite/abc");
      expect(built.text).toContain("https://app.lunchportalen.no/invite/abc");

      const copy = employeeInviteCopy(locale);
      expect(built.html).toContain(copy.hero);
      expect(built.text).toContain(copy.cta);
      expect(built.text).toContain(copy.nextSteps[0]);

      expect(built.subject).not.toMatch(RAW_KEY_PATTERN);
      expect(built.html).not.toMatch(MOJIBAKE);
      expect(built.text).not.toMatch(MOJIBAKE);
    });
  }

  test("nb preserves canonical Norwegian copy", () => {
    const built = buildEmployeeInviteEmail({
      companyName: "Acme AS",
      inviteUrl: "https://x/y",
      locale: "nb",
    });
    expect(built.subject).toBe("Du er invitert til firmalunsj hos Acme AS");
    expect(built.html).toContain("Velkommen til Lunchportalen");
    expect(built.html).toContain("Opprett ansattkonto");
    expect(built.html).toMatch(/lang="(no|nb)"/);
  });

  test("sv/da/de are actually localized (not Norwegian)", () => {
    const sv = buildEmployeeInviteEmail({ companyName: "Acme", inviteUrl: "https://x", locale: "sv" });
    expect(sv.subject).toContain("inbjuden");
    expect(sv.html).toMatch(/lang="sv(-SE)?"/);

    const de = buildEmployeeInviteEmail({ companyName: "Acme", inviteUrl: "https://x", locale: "de" });
    expect(de.subject).toContain("eingeladen");

    const da = buildEmployeeInviteEmail({ companyName: "Acme", inviteUrl: "https://x", locale: "da" });
    expect(da.subject).toContain("inviteret");
  });

  test("unknown locale falls back to nb (fail-closed)", () => {
    const built = buildEmployeeInviteEmail({ companyName: "Acme", inviteUrl: "https://x", locale: "xx" });
    expect(built.subject).toContain("invitert");
  });
});

describe("password reset email — all locales", () => {
  for (const locale of APP_LOCALES) {
    test(`${locale}: complete and localized`, () => {
      const { subject, text } = buildPasswordResetEmail("https://app.lunchportalen.no/reset/abc", locale);
      const copy = passwordResetCopy(locale);
      expect(subject).toBe(copy.subject);
      expect(text).toContain("https://app.lunchportalen.no/reset/abc");
      expect(text).toContain(copy.validityNote);
      expect(text).not.toMatch(MOJIBAKE);
    });
  }

  test("nb preserves canonical copy; default is nb", () => {
    const nb = buildPasswordResetEmail("https://x");
    expect(nb.subject).toBe("Tilbakestill passordet ditt i Lunchportalen");
    expect(nb.text).toContain("gyldig i 30 minutter");
  });
});
