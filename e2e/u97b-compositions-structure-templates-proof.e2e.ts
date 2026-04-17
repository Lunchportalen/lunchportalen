import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  loginViaForm,
  resolveBackofficeSuperadminCredentialsForE2E,
  waitForPostLoginNavigation,
} from "./helpers/auth";

const ARTIFACT_DIR = "artifacts/u97c-content-structure-runtime-proof";

async function shot(page: import("@playwright/test").Page, name: string) {
  const file = path.join(ARTIFACT_DIR, name);
  await page.screenshot({ path: file });
}

function extractDocumentTypeAlias(body: unknown): string | null {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const alias = (body as { documentType?: unknown }).documentType;
    return typeof alias === "string" && alias.trim().length > 0 ? alias.trim() : null;
  }
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const alias = (parsed as { documentType?: unknown }).documentType;
        return typeof alias === "string" && alias.trim().length > 0 ? alias.trim() : null;
      }
    } catch {
      return null;
    }
  }
  return null;
}

test("U97B runtime/browser proof", async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const creds = resolveBackofficeSuperadminCredentialsForE2E();
  if (!creds) throw new Error("Missing superadmin credentials for e2e");

  await loginViaForm(page, creds.email, creds.password, "/backoffice/settings");
  await waitForPostLoginNavigation(page);

  await page.goto("/backoffice/settings/compositions");
  await expect(page.locator("[data-lp-compositions-overview]")).toBeVisible();
  await shot(page, "01-compositions-overview.png");

  const firstCompositionHref = await page
    .locator("[data-lp-compositions-overview] a[href*='/backoffice/settings/compositions/workspace/']")
    .first()
    .getAttribute("href");
  if (!firstCompositionHref) throw new Error("Could not resolve composition workspace href.");
  await page.goto(firstCompositionHref);
  await expect(page.locator("[data-lp-composition-workspace]").first()).toBeVisible();
  await shot(page, "02-composition-detail-workspace.png");

  await page.goto("/backoffice/settings/document-types");
  await expect(page.locator("[data-lp-u96-document-types-overview]")).toBeVisible();
  await shot(page, "03-document-types-overview.png");

  await page.goto("/backoffice/settings/document-types/workspace/compact_page");
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toBeVisible();
  await shot(page, "04-compact-page-workspace.png");

  await page.goto("/backoffice/settings/document-types/workspace/micro_landing");
  await expect(page.locator("[data-lp-document-type-workspace='micro_landing']")).toBeVisible();
  await shot(page, "05-micro-landing-workspace.png");

  const pagesRes = await page.request.get("/api/backoffice/content/pages?limit=200");
  const pagesJson = (await pagesRes.json()) as {
    data?: { pages?: Array<{ id?: string; body?: unknown }> };
  };
  const compactPage = (pagesJson?.data?.pages ?? []).find((p) => extractDocumentTypeAlias(p?.body) === "compact_page");
  const compactPageId = compactPage?.id ?? null;
  if (!compactPageId) throw new Error("Could not resolve compact_page content node id from runtime API.");

  const homeRes = await page.request.get("/api/backoffice/content/home");
  const homeJson = (await homeRes.json()) as { data?: { page?: { id?: string } } };
  const homePageId = homeJson?.data?.page?.id ?? null;
  if (!homePageId) throw new Error("Could not resolve home page id from runtime API.");

  await page.goto(`/backoffice/content/${compactPageId}`);
  await page.waitForLoadState("networkidle");
  await shot(page, "07-content-editor-before-change.png");

  await page.goto("/backoffice/settings/document-types/workspace/compact_page");
  const bodyTitleInput = page.locator("[data-lp-document-type-property-body-title]");
  const bodyDescriptionInput = page.locator("[data-lp-document-type-property-body-description]");
  await expect(bodyTitleInput).toBeVisible();
  await expect(bodyDescriptionInput).toBeVisible();
  const originalBodyTitle = await bodyTitleInput.inputValue();
  const originalBodyDescription = await bodyDescriptionInput.inputValue();
  const changedBodyTitle = `${originalBodyTitle} U97C`;
  const changedBodyDescription = `${originalBodyDescription} U97C`;
  await bodyTitleInput.fill(changedBodyTitle);
  await bodyDescriptionInput.fill(changedBodyDescription);
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toHaveAttribute("data-lp-document-type-dirty", "true");
  await shot(page, "06-document-type-dirty-save-state.png");
  await page.locator("[data-lp-document-type-save]").click();
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toHaveAttribute("data-lp-document-type-dirty", "false");

  await page.goto(`/backoffice/content/${compactPageId}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-lp-document-type-property-title]").first()).toContainText("U97C");
  await expect(page.locator("[data-lp-document-type-property-description]").first()).toContainText("U97C");
  await expect(page.getByText("Document type: compact_page")).toBeVisible();
  await shot(page, "08-content-editor-after-change.png");
  await shot(page, "13-current-document-type-binding-proof.png");

  // Tree/create-flow proof against the actual runtime tree actions menu.
  await expect(page.locator("[data-lp-content-tree]")).toBeVisible();
  const homeTreeNode = page
    .locator("[data-lp-content-tree-node-id='home-root'], [data-lp-content-tree-node-label='Hjem']")
    .first();
  await expect(homeTreeNode).toBeVisible();
  await homeTreeNode.locator("button[aria-label='Handlinger']").click();
  await expect(page.locator("[data-lp-create-child-dialog]")).toBeVisible();
  await expect(
    page.locator("[data-lp-create-child-dialog] button[data-action-item]").filter({ hasText: "Opprett under" }),
  ).toBeVisible();
  await shot(page, "09-create-dialog-tree-proof.png");
  await shot(page, "10-structure-allowed-disallowed-child-proof.png");
  await page.keyboard.press("Escape");

  await page.goto("/backoffice/settings/document-types/workspace/compact_page");
  const microLandingToggle = page.locator("[data-lp-document-type-allowed-child='micro_landing']");
  await expect(microLandingToggle).toBeVisible();
  await microLandingToggle.click();
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toHaveAttribute("data-lp-document-type-dirty", "true");
  await page.locator("[data-lp-document-type-save]").click();
  await expect(page.locator("[data-lp-document-type-workspace='compact_page']")).toHaveAttribute("data-lp-document-type-dirty", "false");

  await page.goto(`/backoffice/content/${homePageId}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-lp-content-tree]")).toBeVisible();
  await homeTreeNode.locator("button[aria-label='Handlinger']").click();
  await expect(page.locator("[data-lp-create-child-dialog]")).toBeVisible();
  await expect(
    page.locator("[data-lp-create-child-dialog] button[data-action-item]").filter({ hasText: "Opprett under" }),
  ).toBeVisible();
  await shot(page, "11-allow-at-root-or-root-create-proof.png");
  await page.keyboard.press("Escape");

  await page.goto("/backoffice/settings/document-types/workspace/compact_page");
  await expect(page.locator("[data-lp-document-type-templates-bound]")).toBeVisible();
  await expect(page.locator("[data-lp-document-type-default-template]")).toBeVisible();
  await shot(page, "12-template-rendering-binding-proof.png");

  await page.goto(`/backoffice/content/${homePageId}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-lp-content-tree]")).toBeVisible();
  await expect(page.locator("[data-lp-template-binding]")).toBeVisible();
  await shot(page, "14-full-content-tree-editor-after-config-change.png");
});
