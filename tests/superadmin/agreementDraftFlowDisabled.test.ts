import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import CreateAgreementDraftButton from "@/app/superadmin/registrations/[companyId]/CreateAgreementDraftButton";
import { AGREEMENT_DRAFT_FLOW_DISABLED_UI_COPY } from "@/lib/server/superadmin/agreementDraftFlowDisabled";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("CreateAgreementDraftButton — no active draft action", () => {
  test("renders informational copy only (no Opprett avtaleutkast button)", () => {
    const node = CreateAgreementDraftButton({ companyId: "test-company" });
    const serialized = JSON.stringify(node);

    expect(serialized).toContain(AGREEMENT_DRAFT_FLOW_DISABLED_UI_COPY);
    expect(serialized).not.toMatch(/Opprett avtaleutkast/i);
    expect(serialized).not.toContain('"type":"button"');
  });
});

describe("active app/api routes must not call lp_agreement_create_pending", () => {
  test("no app/api handler invokes lp_agreement_create_pending or createAgreementDraftFromRegistration", () => {
    const root = join(process.cwd(), "app", "api");
    const files = walk(root);
    const hits: string[] = [];

    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf8"));
      if (
        src.includes('rpc("lp_agreement_create_pending"') ||
        src.includes("createAgreementDraftFromRegistration(")
      ) {
        hits.push(file.replace(process.cwd(), ""));
      }
    }

    expect(hits).toEqual([]);
  });
});
