import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { formatAdminTopbarDate } from "@/app/admin/AdminTopbar";

const TOPBAR_PATH = join(process.cwd(), "app", "admin", "AdminTopbar.tsx");
const USER_MENU_PATH = join(process.cwd(), "app", "admin", "AdminTopbarUserMenu.client.tsx");

describe("AdminTopbar", () => {
  test("rendrer pageTitle som h1", () => {
    const source = readFileSync(TOPBAR_PATH, "utf-8");
    expect(source).toContain('<h1 className="ds-admin-topbar__h1">{pageTitle}</h1>');
  });

  test("dato formateres med ukedag og dd.MM.yyyy", () => {
    const formatted = formatAdminTopbarDate(new Date("2026-05-12T10:00:00Z"));
    expect(formatted).toMatch(/^Tirsdag 12\.05\.2026 · uke 20$/);
  });

  test("Faktura-knappen er anchor med riktig href", () => {
    const source = readFileSync(TOPBAR_PATH, "utf-8");
    expect(source).toContain('<a href="/api/admin/invoices/csv"');
  });

  test("Inviter-knappen er Link til /admin/invite", () => {
    const source = readFileSync(TOPBAR_PATH, "utf-8");
    expect(source).toContain('<Link href="/admin/invite"');
  });

  test("inneholder brukermeny-komponent for utlogging", () => {
    const source = readFileSync(TOPBAR_PATH, "utf-8");
    expect(source).toContain("AdminTopbarUserMenu");
    const menuSource = readFileSync(USER_MENU_PATH, "utf-8");
    expect(menuSource).toContain('className="ds-admin-user-trigger"');
  });
});
