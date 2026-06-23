import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const IMPORT_NEEDLE = "providerMenuPricePreview";

const ALLOWED_IMPORTERS = new Set([
  path.normalize("lib/providers/providerMenuPricePreview.ts"),
  path.normalize("lib/providers/providerMenuPricePreviewApi.ts"),
  path.normalize("lib/providers/providerMenuPricePreviewFlag.ts"),
  path.normalize("app/api/provider/menu-days/route.ts"),
  path.normalize("tests/lib/providers/providerMenuPricePreview.test.ts"),
  path.normalize("tests/lib/providers/providerMenuPricePreview.guard.test.ts"),
  path.normalize("tests/api/provider-menu-days.test.ts"),
]);

const FORBIDDEN_PREFIXES = [
  "components",
  path.join("lib", "provider-menu"),
  path.join("app", "(app)", "week"),
  path.join("app", "api", "week"),
  path.join("lib", "billing"),
  path.join("lib", "tripletex"),
];

function walkDir(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walkDir(p, out);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function rel(p: string): string {
  return path.normalize(path.relative(ROOT, p));
}

function isAllowedImporter(filePath: string): boolean {
  return ALLOWED_IMPORTERS.has(rel(filePath));
}

describe("providerMenuPricePreview import boundary", () => {
  it("is only imported from allowed preview/API/test files", () => {
    const offenders: string[] = [];

    for (const file of walkDir(ROOT)) {
      const content = fs.readFileSync(file, "utf8");
      if (!content.includes(IMPORT_NEEDLE)) continue;

      if (isAllowedImporter(file)) continue;
      if (rel(file).startsWith(`docs${path.sep}`)) continue;

      offenders.push(rel(file));
    }

    expect(offenders).toEqual([]);
  });

  it("is not referenced under forbidden runtime prefixes", () => {
    const offenders: string[] = [];

    for (const prefix of FORBIDDEN_PREFIXES) {
      const abs = path.join(ROOT, prefix);
      if (!fs.existsSync(abs)) continue;
      for (const file of walkDir(abs)) {
        if (isAllowedImporter(file)) continue;
        const content = fs.readFileSync(file, "utf8");
        if (content.includes(IMPORT_NEEDLE)) {
          offenders.push(rel(file));
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("other app/api routes do not import preview", () => {
    const offenders: string[] = [];
    const apiRoot = path.join(ROOT, "app", "api");
    if (!fs.existsSync(apiRoot)) return;

    for (const file of walkDir(apiRoot)) {
      if (isAllowedImporter(file)) continue;
      const content = fs.readFileSync(file, "utf8");
      if (content.includes(IMPORT_NEEDLE)) {
        offenders.push(rel(file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it("production resolver file does not import preview", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "lib/providers/providerMenuPriceConfig.ts"),
      "utf8",
    );
    expect(src).not.toContain(IMPORT_NEEDLE);
  });
});
