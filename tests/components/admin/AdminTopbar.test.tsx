import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { formatAdminTopbarDate } from "@/app/admin/AdminTopbar";

const TOPBAR_PATH = join(process.cwd(), "app", "admin", "AdminTopbar.tsx");

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

  test("Søk-knapp har aria-label", () => {
    const source = readFileSync(TOPBAR_PATH, "utf-8");
    expect(source).toContain('aria-label="Søk"');
  });
});
