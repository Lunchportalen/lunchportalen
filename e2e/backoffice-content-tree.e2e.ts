// e2e/backoffice-content-tree.e2e.ts — Backoffice content tree + workspace + preview smoke
// Proves: (A) content load + tree + Hjem, (B) Hjem opens real Forside workspace + no duplicate child,
// (C) fixed children visible + one opens workspace, (D) App overlays folder-only, (E) workspace routing.
import { test, expect } from "@playwright/test";
import { getCredentialsForRole, loginViaForm, waitForPostLoginNavigation } from "./helpers/auth";
import { waitForMainContent } from "./helpers/ready";

const hasSuperadminCreds = !!process.env.E2E_SUPERADMIN_EMAIL && !!process.env.E2E_SUPERADMIN_PASSWORD;

/** UUID segment for content page route (RFC 4122). */
const CONTENT_PAGE_ID_REG = /\/backoffice\/content\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i;
/** Base content route with optional query (no page id). */
const CONTENT_BASE_REG = /\/backoffice\/content(\?|$)/;

test.describe("Backoffice content tree + workspace + preview (superadmin)", () => {
  test.skip(!hasSuperadminCreds, "Content tree smoke requires E2E_SUPERADMIN_EMAIL/E2E_SUPERADMIN_PASSWORD");

  test("tree truth, workspace routing, and preview resolution behave coherently", async ({ page, context }) => {
    const creds = getCredentialsForRole("superadmin");
    if (!creds) throw new Error("Missing E2E_SUPERADMIN_* credentials");

    // ——— A) Backoffice content load: tree visible, Hjem visible ———
    await loginViaForm(page, creds.email, creds.password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(CONTENT_BASE_REG);
    await waitForMainContent(page);

    const tree = page.getByRole("tree", { name: /innhold/i });
    await expect(tree).toBeVisible();

    const hjemNodes = tree.getByRole("treeitem", { name: "Hjem" });
    await expect(hjemNodes).toHaveCount(1);
    const hjemNode = hjemNodes.first();

    // ——— Expand Hjem (caret) so we can assert children and no duplicate Forside ———
    await hjemNode.getByRole("button", { name: /utvid|lukk/i }).click();
    const childNames = await tree.getByRole("treeitem").allInnerTexts();

    // C) Expected fixed child labels under Hjem when present (API/title may vary slightly)
    const expectedChildPatterns = [/employee\s*\(?week\)?/i, /superadmin/i, /company\s*admin/i, /kitchen/i, /driver/i];
    for (const re of expectedChildPatterns) {
      if (childNames.some((t) => re.test(t))) {
        await expect(tree.getByRole("treeitem", { name: re })).toBeVisible();
      }
    }

    // Duplicate-home rule: no second "Forside" treeitem under Hjem
    const forsideUnderHjem = tree.getByRole("treeitem", { name: /forside/i });
    await expect(forsideUnderHjem).toHaveCount(0);

    // ——— B) Hjem opens real Forside workspace (URL + main) ———
    await hjemNode.click();
    await expect(page).toHaveURL(CONTENT_PAGE_ID_REG);
    await waitForMainContent(page);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("main")).toContainText(/forside|innhold|redigere|velg en side/i);

    // ——— C) At least one fixed child opens a real workspace ———
    await page.goto(new URL("/backoffice/content", page.url()).toString());
    await waitForMainContent(page);

    let fixedChild = tree.getByRole("treeitem", { name: /employee\s*\(?week\)?|superadmin|company\s*admin|kitchen|driver/i }).first();
    if ((await fixedChild.count()) === 0) {
      const allItems = await tree.getByRole("treeitem").all();
      for (const el of allItems) {
        const text = (await el.textContent()) ?? "";
        if (!/^Hjem$|^App overlays$|^Global$|^Design$/i.test(text.trim())) {
          fixedChild = el;
          break;
        }
      }
    }
    const fixedChildLabel = (await fixedChild.textContent())?.trim() ?? "";
    await fixedChild.click();
    await expect(page).toHaveURL(CONTENT_PAGE_ID_REG);
    await waitForMainContent(page);
    await expect(page.getByRole("main")).toBeVisible();

    // ——— D + E) Global: folder-only, URL stays base; then App overlays must not open fake editor ———
    const globalNode = tree.getByRole("treeitem", { name: "Global" });
    await expect(globalNode).toBeVisible();
    await globalNode.click();
    await expect(page).toHaveURL(CONTENT_BASE_REG);
    await waitForMainContent(page);
    await expect(page.getByText(/global/i)).toBeVisible();

    // App overlays: folder-only — must NOT navigate to /backoffice/content/<uuid>
    const overlaysNode = tree.getByRole("treeitem", { name: "App overlays" });
    await expect(overlaysNode).toBeVisible();
    await overlaysNode.click();
    await expect(page).toHaveURL(CONTENT_BASE_REG);
    await expect(tree).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();

    // Design root: folder-only, real design surface
    const designNode = tree.getByRole("treeitem", { name: "Design" });
    await expect(designNode).toBeVisible();
    await designNode.click();
    await expect(page).toHaveURL(CONTENT_BASE_REG);
    await waitForMainContent(page);
    await expect(page.getByText(/design/i)).toBeVisible();

    // 8) Preview from Hjem (root → "/")
    const [homePreviewPopup] = await Promise.all([
      context.waitForEvent("page"),
      openNodeActionsAndClickPreview(tree, "Hjem"),
    ]);
    await homePreviewPopup.waitForLoadState("domcontentloaded");
    await expect(homePreviewPopup).toHaveURL(/https?:\/\/.+\/$/);
    await homePreviewPopup.close();

    // 9) Preview from one fixed app page (if label gives us a stable target)
    if (/employee\s*\(?week\)?/i.test(fixedChildLabel)) {
      const [popup] = await Promise.all([
        context.waitForEvent("page"),
        openNodeActionsAndClickPreview(tree, fixedChildLabel),
      ]);
      await popup.waitForLoadState("domcontentloaded");
      await expect(popup).toHaveURL(/\/week/);
      await popup.close();
    } else if (/superadmin/i.test(fixedChildLabel)) {
      const [popup] = await Promise.all([
        context.waitForEvent("page"),
        openNodeActionsAndClickPreview(tree, fixedChildLabel),
      ]);
      await popup.waitForLoadState("domcontentloaded");
      await expect(popup).toHaveURL(/\/superadmin/);
      await popup.close();
    } else if (/company admin/i.test(fixedChildLabel)) {
      const [popup] = await Promise.all([
        context.waitForEvent("page"),
        openNodeActionsAndClickPreview(tree, fixedChildLabel),
      ]);
      await popup.waitForLoadState("domcontentloaded");
      await expect(popup).toHaveURL(/\/admin/);
      await popup.close();
    } else if (/kitchen/i.test(fixedChildLabel)) {
      const [popup] = await Promise.all([
        context.waitForEvent("page"),
        openNodeActionsAndClickPreview(tree, fixedChildLabel),
      ]);
      await popup.waitForLoadState("domcontentloaded");
      await expect(popup).toHaveURL(/\/kitchen/);
      await popup.close();
    } else if (/driver/i.test(fixedChildLabel)) {
      const [popup] = await Promise.all([
        context.waitForEvent("page"),
        openNodeActionsAndClickPreview(tree, fixedChildLabel),
      ]);
      await popup.waitForLoadState("domcontentloaded");
      await expect(popup).toHaveURL(/\/driver/);
      await popup.close();
    }
  });
});

async function openNodeActionsAndClickPreview(
  tree: import("@playwright/test").Locator,
  nodeLabel: string
) {
  const row = tree.getByRole("treeitem", { name: new RegExp(nodeLabel, "i") }).first();
  await expect(row).toBeVisible();
  const actionsButton = row.getByRole("button", { name: /handlinger/i });
  await actionsButton.click();
  const previewItem = tree.page().getByRole("menuitem", { name: /forhåndsvis/i }).first();
  await expect(previewItem).toBeVisible();
  await previewItem.click();
}

