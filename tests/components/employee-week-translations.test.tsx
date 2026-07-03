/**
 * SMART-3 — employee week translation UI honesty tests.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();

describe("employee week translations UI", () => {
  test("EmployeeWeekClient explains partial approved translation behavior", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "app/(app)/week/EmployeeWeekClient.tsx"),
      "utf8",
    );
    expect(src).toMatch(/godkjente menytekster/i);
    expect(src).toMatch(/Originaltekst vises ellers/i);
    expect(src).not.toMatch(/alle menyer er oversatt/i);
    expect(src).not.toMatch(/AI-oversettelse/i);
  });

  test("HeaderShell enables LocaleSwitcher for employees (SMART-3)", () => {
    const src = fs.readFileSync(path.join(ROOT, "components/nav/HeaderShell.tsx"), "utf8");
    expect(src).toMatch(/showLocaleSwitcher\s*=\s*true/);
  });

  test("order write body builder still uses keys not display titles", () => {
    const src = fs.readFileSync(path.join(ROOT, "app/(app)/week/EmployeeWeekClient.tsx"), "utf8");
    expect(src).toContain("buildOrderWriteBody");
    expect(src).toMatch(/choice_key/);
    expect(src).toMatch(/itemKey/);
  });
});
