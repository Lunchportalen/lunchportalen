import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();

function repoPath(relativePath: string) {
  return path.join(repoRoot, relativePath);
}

function readRepoFile(relativePath: string) {
  return fs.readFileSync(repoPath(relativePath), "utf8");
}

describe("No zombie CMS surfaces", () => {
  test("visible auth and content entrypoints resolve to live canonical files", () => {
    expect(fs.existsSync(repoPath("app/(auth)/login/page.tsx"))).toBe(true);
    expect(fs.existsSync(repoPath("app/(auth)/login/LoginForm.tsx"))).toBe(true);
    expect(fs.existsSync(repoPath("app/(backoffice)/backoffice/content/page.tsx"))).toBe(true);
    expect(fs.existsSync(repoPath("app/(backoffice)/backoffice/content/[id]/page.tsx"))).toBe(true);
    expect(fs.existsSync(repoPath("app/api/auth/login/route.ts"))).toBe(true);
    expect(fs.existsSync(repoPath("app/api/backoffice/ai/suggest/route.ts"))).toBe(true);
    expect(fs.existsSync(repoPath("app/api/backoffice/ai/capability/route.ts"))).toBe(true);
    expect(fs.existsSync(repoPath("app/api/health/route.ts"))).toBe(true);
  });

  test("login page points at the canonical LoginForm and the removed zombie client is gone", () => {
    const loginPage = readRepoFile("app/(auth)/login/page.tsx");

    expect(loginPage).toContain('import LoginForm from "./LoginForm";');
    expect(loginPage).toContain("<LoginForm");
    expect(fs.existsSync(repoPath("app/(auth)/login/loginClient.tsx"))).toBe(false);
  });

  test("editor AI shell no longer exposes dead or duplicated panel chrome", () => {
    const rightPanel = readRepoFile("app/(backoffice)/backoffice/content/_components/RightPanel.tsx");
    const rightRail = readRepoFile(
      "app/(backoffice)/backoffice/content/_components/ContentWorkspaceRightRail.tsx",
    );

    expect(rightPanel).toContain("Kanonisk editor-AI");
    expect(rightPanel).not.toContain("Strategi og ledelse");
    expect(rightPanel).not.toContain("{props.ceoSlot}");
    expect(rightRail).toContain("Kun den kanoniske forbedringsflyten er synlig her.");
    expect(rightRail).toContain("Utvidede AI-flater er skjult");
    expect(rightRail).toContain("const ceoSlot = null;");
    expect(rightRail).not.toContain("onGenerateSections={workspaceAi.handleAiGenerateSections}");
    expect(rightRail).not.toContain("onLayoutSuggestions={workspaceAi.handleLayoutSuggestions}");
  });
});
