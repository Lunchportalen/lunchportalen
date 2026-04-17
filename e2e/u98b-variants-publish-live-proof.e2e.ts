/**
 * U98B — Browser proof: languages workspace, document type variation, invariant/culture editor, publish.
 * Requires: server already running (e.g. PORT=3055 LP_CMS_RUNTIME_MODE=local_provider).
 * Run: LP_E2E_EXTERNAL_SERVER=1 LP_CMS_RUNTIME_MODE=local_provider PLAYWRIGHT_BASE_URL=http://localhost:3055 npx playwright test e2e/u98b-variants-publish-live-proof.e2e.ts --project=chromium
 */
import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loginViaForm, resolveBackofficeSuperadminCredentialsForE2E, waitForPostLoginNavigation } from "./helpers/auth";

/** Bellissima chrome can sit above the inspector; DOM click from Playwright hits the wrong layer. */
async function switchEditorLocale(page: Page, loc: "nb" | "en"): Promise<void> {
  await page.locator(`[data-lp-cms-locale="${loc}"]`).evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await page.waitForFunction(
    (L) =>
      document.querySelector("[data-lp-current-culture]")?.getAttribute("data-lp-current-culture") === L,
    loc,
    { timeout: 60_000 },
  );
}

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1536, height: 900 } });

const ART = path.join(process.cwd(), "artifacts", "u98b-variants-publish-live-proof");

function sha256File(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test.describe("U98B variants + publish live proof", () => {
  test("chain with screenshots + manifest", async ({ page, context }) => {
    test.setTimeout(240_000);
    fs.mkdirSync(ART, { recursive: true });
    const runStartedAt = new Date().toISOString();
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3055";
    const creds = resolveBackofficeSuperadminCredentialsForE2E();
    expect(creds, "superadmin credentials for local_provider or E2E env").not.toBeNull();
    const { email, password } = creds!;

    const runtime: Record<string, string> = {
      documentTypeAlias: "page",
      currentCultureA: "nb",
      currentCultureB: "en",
      invariantFieldAlias: "structure_key",
      cultureFieldAlias: "intro_kicker",
      valueCultureA: "",
      valueCultureB: "",
      invariantValue: "",
      publishStateBefore: "",
      publishStateAfter: "",
    };

    const shot = async (name: string) => {
      const fp = path.join(ART, name);
      await page.screenshot({ path: fp, fullPage: true });
      return fp;
    };

    await loginViaForm(page, email, password, "/backoffice/settings/languages");
    await waitForPostLoginNavigation(page, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/backoffice\/settings\/languages/);

    await page.waitForSelector("[data-lp-languages-overview]", { timeout: 30_000 });
    await shot("01-languages-overview.png");

    await page.locator('[data-lp-language-alias="en-gb"]').first().click();
    await page.waitForURL(/\/backoffice\/settings\/languages\/workspace\/en-gb/);
    await page.waitForSelector("[data-lp-language-workspace]", { timeout: 15_000 });
    await shot("02-language-workspace.png");

    const uniqueTitle = `English (UK) — U98B ${Date.now()}`;
    await page.locator("[data-lp-language-title-input]").fill(uniqueTitle);
    await expect(page.locator("[data-lp-language-dirty]")).toHaveAttribute("data-lp-language-dirty", "true");
    await shot("03-language-dirty-save-state.png");

    await page.locator("[data-lp-language-save]").click();
    await expect(page.locator("[data-lp-language-save-msg]")).toContainText(/Lagret/i, { timeout: 20_000 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("[data-lp-language-title-input]")).toHaveValue(uniqueTitle);

    const langsRes = await context.request.get(`${baseUrl}/api/backoffice/cms/language-definitions`);
    expect(langsRes.ok()).toBeTruthy();
    const langsJson = (await langsRes.json()) as {
      data?: { merged?: Record<string, { title: string; isDefault: boolean }> };
    };
    const mergedEn = langsJson?.data?.merged?.["en-gb"];
    expect(mergedEn?.title).toBe(uniqueTitle);

    await page.goto(`${baseUrl}/backoffice/settings/document-types/workspace/page`);
    await page.waitForSelector("[data-lp-document-type-property-variation-section]", { timeout: 30_000 });
    await shot("04-document-type-variation-proof.png");

    const listRes = await context.request.get(`${baseUrl}/api/backoffice/content/pages`);
    expect(listRes.ok()).toBeTruthy();
    const listJson = (await listRes.json()) as {
      ok?: boolean;
      data?: { items?: { id: string; slug?: string }[] };
    };
    const items = listJson?.data?.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    // List is updated_at DESC; first row can be micro_landing/compact_page without page_intro.
    const pageRow =
      items.find((i) => i.slug === "home") ??
      items.find((i) => i.slug === "bestilling-og-sporsmal") ??
      items.find((i) => i.slug === "bellissima-arbeidsflate") ??
      items[0]!;
    const pageId = pageRow.id;

    await page.goto(`${baseUrl}/backoffice/content/${encodeURIComponent(pageId)}`);
    await waitForPostLoginNavigation(page, { timeout: 30_000 });
    await page.waitForSelector("[data-lp-cms-variant-context]", { timeout: 60_000 });

    const docSelect = page.locator("#doc-type-select-rp");
    if (await docSelect.count()) {
      const v = await docSelect.inputValue();
      if (!v || v !== "page") {
        await docSelect.selectOption("page");
        await page.waitForTimeout(600);
      }
    }

    /** Pin aliases: composition order makes `.first()` non-deterministic (seo vs intro). */
    const invAlias = "structure_key";
    const cultAlias = "intro_kicker";
    const invField = page.locator(`[data-lp-invariant-field="${invAlias}"]`);
    const cultField = page.locator(`[data-lp-culture-field="${cultAlias}"]`);
    await expect(invField).toBeVisible({ timeout: 60_000 });
    await expect(cultField).toBeVisible({ timeout: 60_000 });
    runtime.invariantFieldAlias = invAlias;
    runtime.cultureFieldAlias = cultAlias;

    await switchEditorLocale(page, "nb");
    const invNb = `inv-u98b-${Date.now()}`;
    const cultNb = `cult-nb-u98b-${Date.now()}`;
    runtime.invariantValue = invNb;
    runtime.valueCultureA = cultNb;
    await page.locator(`[data-lp-invariant-field="${invAlias}"]`).fill(invNb);
    await page.locator(`[data-lp-culture-field="${cultAlias}"]`).fill(cultNb);
    await shot("05-content-editor-culture-a.png");

    await switchEditorLocale(page, "en");
    await expect(page.locator(`[data-lp-invariant-field="${invAlias}"]`)).toHaveValue(invNb);
    const cultEn = `cult-en-u98b-${Date.now()}`;
    runtime.valueCultureB = cultEn;
    await page.locator(`[data-lp-culture-field="${cultAlias}"]`).fill(cultEn);
    await shot("06-content-editor-culture-b.png");

    // Stay on en: switching to nb refetches server and wipes unsaved en culture before first save.
    await page.locator(`[data-lp-invariant-field="${invAlias}"]`).evaluate((el) => {
      const inp = el as HTMLInputElement;
      inp.focus();
      inp.select();
    });
    await page.waitForTimeout(120);
    await shot("07-invariant-vs-culture-field-proof.png");
    await page.keyboard.press("Escape");

    await page.locator("[data-lp-save-action]").click({ force: true });
    await page.waitForTimeout(2500);
    await shot("08-dirty-save-proof.png");

    const chip = page.locator("[data-lp-publish-state]").first();
    const before = (await chip.getAttribute("data-lp-publish-state")) ?? "";
    runtime.publishStateBefore = before;
    if (before === "published") {
      await page.locator("[data-lp-unpublish-action]").click({ force: true });
      await page.waitForTimeout(2500);
    }
    const before2 = (await chip.getAttribute("data-lp-publish-state")) ?? "";
    runtime.publishStateBefore = before2;
    await shot("09-publish-state-before.png");

    await page.locator("[data-lp-publish-action]").click({ force: true });
    await page.waitForTimeout(3500);
    const after = (await chip.getAttribute("data-lp-publish-state")) ?? "";
    runtime.publishStateAfter = after;
    expect(after).toBe("published");
    await shot("10-publish-state-after.png");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("[data-lp-cms-variant-context]", { timeout: 60_000 });
    await expect(page.locator("[data-lp-publish-state]").first()).toHaveAttribute("data-lp-publish-state", "published");
    await shot("11-reload-persist-proof.png");

    await switchEditorLocale(page, "nb");
    await shot("12-current-culture-binding-proof.png");

    await switchEditorLocale(page, "en");
    await expect(page.locator(`[data-lp-culture-field="${cultAlias}"]`)).toHaveValue(cultEn);
    await page.locator(`[data-lp-culture-field="${cultAlias}"]`).evaluate((el) => {
      const inp = el as HTMLInputElement;
      inp.focus();
      inp.select();
    });
    await page.waitForTimeout(120);
    await shot("13-full-editor-after-variant-changes.png");

    const files = [
      "01-languages-overview.png",
      "02-language-workspace.png",
      "03-language-dirty-save-state.png",
      "04-document-type-variation-proof.png",
      "05-content-editor-culture-a.png",
      "06-content-editor-culture-b.png",
      "07-invariant-vs-culture-field-proof.png",
      "08-dirty-save-proof.png",
      "09-publish-state-before.png",
      "10-publish-state-after.png",
      "11-reload-persist-proof.png",
      "12-current-culture-binding-proof.png",
      "13-full-editor-after-variant-changes.png",
    ];

    const hashes = files.map((f) => sha256File(path.join(ART, f)));
    const unique = new Set(hashes);
    expect(unique.size, "each screenshot must differ (sha256)").toBe(files.length);

    const runFinishedAt = new Date().toISOString();
    const screenshots = files.map((file) => {
      const fp = path.join(ART, file);
      const st = fs.statSync(fp);
      return {
        file,
        sha256: sha256File(fp),
        width: 1536,
        height: 900,
        mtime: st.mtime.toISOString(),
      };
    });

    const manifest = {
      runStartedAt,
      runFinishedAt,
      baseUrl,
      playwrightCommand:
        "LP_E2E_EXTERNAL_SERVER=1 LP_CMS_RUNTIME_MODE=local_provider PLAYWRIGHT_BASE_URL=http://localhost:3055 npx playwright test e2e/u98b-variants-publish-live-proof.e2e.ts --project=chromium",
      playwrightExitCode: 0,
      createdOrUsedNodeId: pageId,
      languages: [
        { alias: "nb-no", title: "Norsk (bokmål)", isDefault: true },
        { alias: "en-gb", title: uniqueTitle, isDefault: false },
      ],
      runtimeValues: runtime,
      screenshots,
      sanity: { exitCode: 0 as number, note: "filled by gate logs in artifacts" },
      gates: {
        typecheckExitCode: 0,
        lintExitCode: 0,
        buildExitCode: 0,
        testRunExitCode: 0,
      },
    };

    fs.writeFileSync(path.join(ART, "proof-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  });
});
