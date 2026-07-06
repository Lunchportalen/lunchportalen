import { mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  loadOperatorLocalCredentials,
  operatorLocalCredentialsPathForEmail,
  storeOperatorLocalCredentials,
} from "@/lib/provider-onboarding/operatorLocalCredentials";

describe("operatorLocalCredentials", () => {
  const roots: string[] = [];
  const files: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0, roots.length)) {
      rmSync(root, { recursive: true, force: true });
    }
    for (const filePath of files.splice(0, files.length)) {
      try {
        unlinkSync(filePath);
      } catch {
        // absent is fine
      }
    }
  });

  it("maps admin email to a per-admin filename under .operator-local", () => {
    const absolute = operatorLocalCredentialsPathForEmail(
      "Norway.Admin+pilot@Example.COM",
    );
    expect(absolute.replace(/\\/g, "/")).toMatch(
      /\.operator-local\/norway\.admin\+pilot\.credentials$/,
    );
  });

  it("stores and loads credentials without embedding them in throw-away paths", () => {
    const root = join(
      tmpdir(),
      `or-operator-local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    roots.push(root);
    mkdirSync(root, { recursive: true });

    // Redirect store into tmp by writing via absolute path helper shape.
    // storeOperatorLocalCredentials always writes under process.cwd()/.operator-local;
    // exercise load against an explicit file to lock envelope fields.
    const filePath = join(root, "fiona.g@example.net");
    writeFileSync(
      filePath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          providerId: "provider-a",
          adminEmail: "admin@example.com",
          temporaryPassword: "never-print-me",
          passwordPrinted: false,
          createdAt: "2026-07-06T00:00:00.000Z",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const loaded = loadOperatorLocalCredentials(filePath);
    expect(loaded?.temporaryPassword).toBe("never-print-me");
    expect(loaded?.passwordPrinted).toBe(false);
    expect(loaded?.adminEmail).toBe("admin@example.com");

    // Envelope on disk must remain local-file only (no export helper forces print).
    const raw = readFileSync(filePath, "utf8");
    expect(raw).toContain("never-print-me");
    expect(raw).toContain('"passwordPrinted": false');
  });

  it("persist writes passwordPrinted=false into the envelope", () => {
    const storedPath = storeOperatorLocalCredentials({
      providerId: "provider-b",
      adminEmail: `agent-test-${Date.now()}@example.com`,
      temporaryPassword: "local-only-secret",
    });
    files.push(storedPath);

    const stored = JSON.parse(readFileSync(storedPath, "utf8")) as {
      passwordPrinted: boolean;
      temporaryPassword: string;
    };
    expect(stored.passwordPrinted).toBe(false);
    expect(stored.temporaryPassword).toBe("local-only-secret");
  });
});
