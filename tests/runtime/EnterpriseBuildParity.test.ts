import fs from "node:fs";
import path from "node:path";

import { globSync } from "glob";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";
import { NEXT_BUILD_DIST_DIR } from "@/lib/runtime/nextOutput";

const repoRoot = process.cwd();
const sourceIgnore = ["**/node_modules/**", "**/.next/**", "**/dist/**", "studio/**", "archive/**"];

describe("Enterprise build parity", () => {
  it("keeps /_document as a generated Next internal instead of a repo source dependency", () => {
    expect(fs.existsSync(path.join(repoRoot, "pages"))).toBe(false);

    const documentFiles = globSync("**/_document.{js,jsx,ts,tsx}", {
      cwd: repoRoot,
      ignore: sourceIgnore,
      nodir: true,
    });
    expect(documentFiles).toEqual([]);

    const sourceFiles = globSync(
      [
        "next.config.ts",
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "scripts/**/*.{js,mjs,ts}",
      ],
      {
        cwd: repoRoot,
        ignore: sourceIgnore,
        nodir: true,
      },
    );

    const nextDocumentImports = sourceFiles.filter((filePath) =>
      fs.readFileSync(path.join(repoRoot, filePath), "utf8").includes("next/document"),
    );

    expect(nextDocumentImports).toEqual([]);
  });

  it("keeps production build output routed through the configured enterprise distDir", () => {
    expect(nextConfig(PHASE_PRODUCTION_BUILD).distDir).toBe(NEXT_BUILD_DIST_DIR);
  });
});
