import { describe, expect, test } from "vitest";

import {
  EMPLOYEE_ACTIVATION_CTA_EMAIL,
  EMPLOYEE_ACTIVATION_CTA_FORM,
  EMPLOYEE_ACTIVATION_EXPIRY_NOTE,
  EMPLOYEE_ACTIVATION_PAGE_TITLE,
  EMPLOYEE_ACTIVATION_SECURITY_NOTE,
  employeeActivationEmailSubject,
} from "@/lib/onboarding/employeeActivationCopy";
import { buildEmployeeInviteEmail } from "@/lib/email/templates/employeeInvite";

describe("buildEmployeeInviteEmail", () => {
  const base = {
    companyName: "Pettersen&Co",
    inviteUrl: "https://app.lunchportalen.no/register/employee?token=secret-token-value",
  };

  test("renders enterprise HTML email", () => {
    const out = buildEmployeeInviteEmail(base);
    expect(out.html.length).toBeGreaterThan(500);
    expect(out.text.length).toBeGreaterThan(200);
    expect(out.subject).toBe(employeeActivationEmailSubject("Pettersen&Co"));
  });

  test("includes CTA Opprett ansattkonto in href", () => {
    const out = buildEmployeeInviteEmail(base);
    expect(out.html).toContain(`href="${base.inviteUrl}"`);
    expect(out.html).toContain(EMPLOYEE_ACTIVATION_CTA_EMAIL);
    expect(out.html).not.toContain("secret-token-value</");
  });

  test("does not use raw URL as visible primary CTA text", () => {
    const out = buildEmployeeInviteEmail(base);
    expect(out.html).not.toContain(`>${base.inviteUrl}<`);
  });

  test("shows company name when available", () => {
    const out = buildEmployeeInviteEmail(base);
    expect(out.html).toContain("Pettersen&amp;Co");
    expect(out.text).toContain("Pettersen&Co");
  });

  test("shows provider and location only when provided", () => {
    const withMeta = buildEmployeeInviteEmail({
      ...base,
      providerName: "Melhus Catering AS",
      locationName: "Hovedkontor",
    });
    expect(withMeta.html).toContain("Melhus Catering AS");
    expect(withMeta.html).toContain("Hovedkontor");

    const withoutMeta = buildEmployeeInviteEmail(base);
    expect(withoutMeta.html).not.toContain("Melhus Catering AS");
  });

  test("includes expiry and security copy", () => {
    const out = buildEmployeeInviteEmail(base);
    expect(out.html).toContain(EMPLOYEE_ACTIVATION_SECURITY_NOTE);
    expect(out.text).toContain(EMPLOYEE_ACTIVATION_EXPIRY_NOTE);
  });

  test("does not include script tags", () => {
    const out = buildEmployeeInviteEmail(base);
    expect(out.html.toLowerCase()).not.toContain("<script");
  });

  test("falls back without hardcoded company in template logic", () => {
    const out = buildEmployeeInviteEmail({ ...base, companyName: "" });
    expect(out.subject).toBe("Du er invitert til Lunchportalen");
    expect(out.html).not.toContain("Pettersen");
  });
});

describe("employee registration surface", () => {
  test("register client uses enterprise CTA copy", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const client = await fs.readFile(
      path.join(process.cwd(), "app/(auth)/register/employee/RegisterEmployeeClient.tsx"),
      "utf8",
    );
    expect(client).toContain("EMPLOYEE_ACTIVATION_CTA_FORM");
    expect(client).toContain("employee-password");
    expect(client).toContain('showPassword ? "Skjul" : "Vis"');
    expect(client).not.toContain("Aktiver konto");
  });

  test("register page uses enterprise onboarding layout", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const page = await fs.readFile(path.join(process.cwd(), "app/(auth)/register/employee/page.tsx"), "utf8");
    expect(page).toContain("RegisterEmployeeInviteStateCard");
    expect(page).toContain("EMPLOYEE_ACTIVATION_PAGE_TITLE");
    expect(page).toContain("lg:grid-cols");
    expect(page).not.toContain("AcceptInviteClient");
  });

  test("invalid invite state uses friendly copy", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const page = await fs.readFile(path.join(process.cwd(), "app/(auth)/register/employee/page.tsx"), "utf8");
    const card = await fs.readFile(
      path.join(process.cwd(), "app/(auth)/register/employee/RegisterEmployeeInviteStateCard.tsx"),
      "utf8",
    );
    expect(page).toContain("EMPLOYEE_INVITE_UNAVAILABLE_TITLE");
    expect(card).toContain('href="/login"');
    expect(page).not.toContain("?token=");
  });

  test("page title uses Opprett ansattkonto", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const page = await fs.readFile(path.join(process.cwd(), "app/(auth)/register/employee/page.tsx"), "utf8");
    const client = await fs.readFile(
      path.join(process.cwd(), "app/(auth)/register/employee/RegisterEmployeeClient.tsx"),
      "utf8",
    );
    expect(page).toContain(EMPLOYEE_ACTIVATION_PAGE_TITLE);
    expect(client).toContain("EMPLOYEE_ACTIVATION_CTA_FORM");
    expect(client).not.toContain("Aktiver konto");
  });
});
