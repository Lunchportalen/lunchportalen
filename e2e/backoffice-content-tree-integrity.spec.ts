// e2e/backoffice-content-tree-integrity.spec.ts
// Backoffice content tree integrity: roots, folders, pages behave coherently.
import { test, expect } from "@playwright/test";
import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
} from "./helpers/auth";
import { waitForMainContent } from "./helpers/ready";

const hasSuperadminCreds =
  !!process.env.E2E_SUPERADMIN_EMAIL && !!process.env.E2E_SUPERADMIN_PASSWORD;

const CONTENT_BASE_REG = /\/backoffice\/content(\?|$)/;
const CONTENT_PAGE_ID_REG =
  /\/backoffice\/content\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

test.describe("Backoffice content tree integrity (superadmin)", () => {
  test.skip(
    !hasSuperadminCreds,
    "Content tree integrity test requires E2E_SUPERADMIN_EMAIL/E2E_SUPERADMIN_PASSWORD",
  );

  test("Hjem, fixed app pages, and App overlays behave as coherent tree navigation", async ({
    page,
  }) => {
    const creds = getCredentialsForRole("superadmin");
    if (!creds) throw new Error("Missing E2E_SUPERADMIN_* credentials");

    // Open backoffice content and wait for shell + tree.
    await loginViaForm(page, creds.email, creds.password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(CONTENT_BASE_REG);
    await waitForMainContent(page);

    const tree = page.getByRole("tree", { name: /innhold/i });
    await expect(tree).toBeVisible();

    // A) Hjem is singular and clickable.
    const hjemNodes = tree.getByRole("treeitem", { name: /^Hjem$/ });
    await expect(hjemNodes).toHaveCount(1);
    const hjemNode = hjemNodes.first();
    await expect(hjemNode).toBeVisible();

    // B) Clicking Hjem opens real Forside editor (page route + main editor surface).
    await hjemNode.click();
    await expect(page).toHaveURL(CONTENT_PAGE_ID_REG);
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    await expect(main).toContainText(/forside|innhold|redigere|velg en side/i);
    await expect(hjemNode).toHaveAttribute("aria-selected", "true");

    // C) Expand Hjem and assert no duplicate Forside/Hjem child exists.
    const hjemToggle = hjemNode.getByRole("button", { name: /utvid|lukk/i });
    await hjemToggle.click();

    const hjemLikeNodes = tree.getByRole("treeitem", {
      name: /hjem|forside/i,
    });
    await expect(hjemLikeNodes).toHaveCount(1);

    // D) Fixed app children under Hjem (if present).
    const fixedChildPatterns = [
      /superadmin/i,
      /company\s*admin/i,
      /employee\s*\(?week\)?/i,
      /kitchen/i,
      /driver/i,
    ];

    let pageChild = tree
      .getByRole("treeitem", {
        name: /superadmin|company\s*admin|employee\s*\(?week\)?|kitchen|driver/i,
      })
      .first();

    for (const re of fixedChildPatterns) {
      const candidate = tree.getByRole("treeitem", { name: re });
      if ((await candidate.count()) > 0) {
        await expect(candidate.first()).toBeVisible();
        if ((await pageChild.count()) === 0) {
          pageChild = candidate.first();
        }
      }
    }

    // E) App overlays is a separate folder/root and does not live under Hjem.
    const overlaysNode = tree.getByRole("treeitem", { name: "App overlays" });
    await expect(overlaysNode).toBeVisible();

    // After expanding Hjem, its descendants must not include "App overlays".
    const overlaysUnderHjem = tree
      .getByRole("treeitem", { name: "App overlays" })
      .filter({ hasNot: hjemNode });
    await expect(overlaysUnderHjem).toHaveCount(1); // single root-level node only

    // Fixed app children must not be duplicated under App overlays.
    await overlaysNode.click(); // folder behavior: expand/collapse only.
    const overlaysExpanded = await overlaysNode.getAttribute("aria-expanded");
    // URL must remain on base content route (no page navigation for folder).
    await expect(page).toHaveURL(CONTENT_BASE_REG);

    for (const re of fixedChildPatterns) {
      const underOverlays = overlaysNode.getByRole("treeitem", { name: re });
      await expect(underOverlays).toHaveCount(0);
    }

    // F1) Root behavior: Hjem already navigated to real editor above.

    // F2) Folder behavior: App overlays toggles expanded state without editor navigation.
    if (overlaysExpanded === "true") {
      await overlaysNode.click();
    } else {
      await overlaysNode.click();
      await overlaysNode.click();
    }
    await expect(page).toHaveURL(CONTENT_BASE_REG);

    // F3) Page behavior: clicking a fixed child page node opens a real editor route.
    if ((await pageChild.count()) > 0) {
      const beforeUrl = page.url();
      await pageChild.click();
      await expect(page).toHaveURL(CONTENT_PAGE_ID_REG);
      await expect(page).not.toHaveURL(beforeUrl);
      await waitForMainContent(page);
      await expect(main).toBeVisible();
    }
  });
});

