import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("CMS AI auth/runtime parity", () => {
  test("editor client sends only canonical workspace context to the backoffice suggest route", () => {
    const clientSource = readRepoFile(
      "app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi.ts",
    );

    expect(clientSource).toContain('void callAiSuggest(');
    expect(clientSource).toContain('"content.maintain.page"');
    expect(clientSource).toContain("pageId: effectiveId ?? null");
    expect(clientSource).toContain("variantId: null");
    expect(clientSource).toContain("blocks: buildAiBlocks(blocks)");
    expect(clientSource).toContain("existingBlocks: buildAiExistingBlocks(blocks)");
    expect(clientSource).toContain("meta: buildAiMeta(meta)");
    expect(clientSource).toContain("validateEditorBlockTypesForGovernedApply(");
    expect(clientSource).toContain("documentTypeAlias");
    expect(clientSource).toContain("editorBlocks");
    expect(clientSource).toContain("mergedBlockEditorDataTypes");
  });

  test("editor AI route reuses canonical server auth truth and fails closed on role or tenant gaps", () => {
    const suggestRoute = readRepoFile("app/api/backoffice/ai/suggest/route.ts");

    expect(suggestRoute).toContain('await import("@/lib/http/routeGuard")');
    expect(suggestRoute).toContain("const gate = await scopeOr401(request);");
    expect(suggestRoute).toContain('const deny = requireRoleOr403(ctx, ["superadmin"]);');
    expect(suggestRoute).toContain('return jsonErr(ctx.rid, "Mangler tenant eller bruker for AI.", 422, result.error);');
    expect(suggestRoute).toContain('return jsonErr(ctx.rid, "Kunne ikke lagre forslag (sporbarhet).", 500, "SUGGESTION_INSERT_FAILED");');
    expect(suggestRoute).not.toContain("getLocalRuntimeAuthState");
    expect(suggestRoute).not.toContain("buildLocalDevAuthSession");
  });

  test("editor AI route derives runtime and tenant context from shared server truth, not client claims", () => {
    const suggestRoute = readRepoFile("app/api/backoffice/ai/suggest/route.ts");
    const healthRoute = readRepoFile("app/api/health/route.ts");
    const publicEnv = readRepoFile("lib/config/env-public.ts");

    expect(suggestRoute).toContain("resolveCmsAiTenantCompanyId(ctx.scope?.companyId ?? null)");
    expect(suggestRoute).toContain('const userId = (ctx.scope?.userId ?? ctx.scope?.sub ?? ctx.scope?.email ?? "").trim();');
    expect(suggestRoute).toContain("Mangler company_id på profil");
    expect(healthRoute).toContain("const cmsRuntime = getCmsRuntimeStatus();");
    expect(publicEnv).toContain('if (cmsRuntime.mode === "local_provider")');
    expect(publicEnv).toContain('return localRuntimeConfigStatus();');
  });
});
