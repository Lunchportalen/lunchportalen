/**
 * U65/U62 — Browser proof for editor AI (canonical UI: Inspector → AI tab → region «AI-assistent» → «Kjør forbedringsforslag»).
 *
 * Run (local_provider):
 *   cross-env LP_CMS_RUNTIME_MODE=local_provider npx playwright test e2e/u62-editor-ai-browser-proof.e2e.ts --project=chromium
 *
 * Run (remote_backend + harness):
 *   cross-env LP_CMS_RUNTIME_MODE=remote_backend LP_REMOTE_BACKEND_AUTH_HARNESS=1 npx playwright test e2e/u62-editor-ai-browser-proof.e2e.ts --project=chromium
 *
 * Remote: set CMS_AI_DEFAULT_COMPANY_ID (or LP_CMS_AI_DEFAULT_COMPANY_ID) for superadmin tenant attribution.
 */
import { test, expect } from "@playwright/test";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import {
  loginViaForm,
  resolveBackofficeSuperadminCredentialsForE2E,
  waitForPostLoginNavigation,
} from "./helpers/auth";
import {
  assertProtectedShellReady,
  dismissContentWorkspaceOnboardingIfPresent,
  dismissEditorCoachmarkIfPresent,
  waitForMainContent,
} from "./helpers/ready";

const CANONICAL_SEED_PAGE_ID = "00000000-0000-4000-8000-00000000c003";

function attachProofListeners(page: import("@playwright/test").Page, failedRequests: { url: string; status: number }[]) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    pageErrors.push(String(err?.message ?? err));
  });
  page.on("response", (res) => {
    const u = res.url();
    if (res.status() >= 400 && u.includes("/api/backoffice/")) {
      failedRequests.push({ url: u, status: res.status() });
    }
  });
  return { consoleErrors, pageErrors };
}

test.describe.configure({ mode: "serial" });

test.describe("U65 — editor AI browser proof", () => {
  test.beforeEach(async ({ page }) => {
    /** Tri-pane editor + sticky workspace footer: default 1280×720 leaves the inspector rail off-screen. */
    await page.setViewportSize({ width: 1600, height: 1000 });
  });

  test("local_provider: login → editor → AI tab → suggest → clean console", async ({
    page,
    browserName,
    baseURL,
  }) => {
    test.setTimeout(480_000);
    test.skip(browserName !== "chromium", "Desktop proof only");
    test.skip(
      String(process.env.LP_CMS_RUNTIME_MODE ?? "").trim().toLowerCase() !== "local_provider",
      "Set LP_CMS_RUNTIME_MODE=local_provider to run this proof against canonical local runtime",
    );

    const resolved = resolveBackofficeSuperadminCredentialsForE2E();
    test.skip(!resolved, "No canonical or E2E superadmin credentials resolved");

    const failedRequests: { url: string; status: number }[] = [];
    const { consoleErrors, pageErrors } = attachProofListeners(page, failedRequests);

    await loginViaForm(page, resolved.email, resolved.password, "/backoffice/content");
    await waitForPostLoginNavigation(page, { timeout: 90_000 });
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await assertProtectedShellReady(page);

    await page.goto(`${baseURL}/backoffice/content/${CANONICAL_SEED_PAGE_ID}`);
    await waitForMainContent(page, { timeout: 30_000 });
    await dismissContentWorkspaceOnboardingIfPresent(page);
    await dismissEditorCoachmarkIfPresent(page);

    const sideNav = page.getByRole("navigation", { name: "Høyre arbeidsflater" });
    await expect(sideNav).toBeVisible({ timeout: 90_000 });
    await sideNav.scrollIntoViewIfNeeded();
    await sideNav.getByRole("button", { name: "AI", exact: true }).click();

    const aiRegion = page.getByRole("region", { name: "AI-assistent" });
    await expect(aiRegion).toBeVisible({ timeout: 15_000 });

    const improveBtn = aiRegion.locator('[data-lp-editor-ai-improve="1"]');
    await expect(improveBtn).toBeVisible({ timeout: 10_000 });
    await expect(improveBtn).toBeEnabled({ timeout: 10_000 });

    await improveBtn.scrollIntoViewIfNeeded();
    const suggestRes = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" && res.url().includes("/api/backoffice/ai/suggest"),
        { timeout: 300_000 },
      ),
      page.evaluate(() => {
        document.querySelector<HTMLButtonElement>('[data-lp-editor-ai-improve="1"]')?.click();
      }),
    ]).then(([res]) => res);
    expect(suggestRes.ok(), `suggest HTTP ${suggestRes.status()}`).toBe(true);
    const req = suggestRes.request();
    const postData = req.postData();
    expect(postData).toBeTruthy();
    const body = JSON.parse(postData!) as { tool?: string };
    expect(body.tool).toBe("content.maintain.page");
    const resJson = (await suggestRes.json()) as { ok?: boolean; data?: unknown };
    expect(resJson?.ok).toBe(true);

    /** Apply path: hook sets lastAppliedTool only when patch merged into editor state (U67). */
    await expect(aiRegion.getByText(/AI oppdaterte innholdet/i)).toBeVisible({ timeout: 60_000 });

    const mainTextDigest = await page.evaluate(() => {
      const el = document.querySelector("main");
      const raw = el?.innerText ?? "";
      return raw.replace(/\s+/g, " ").trim().slice(0, 400);
    });
    expect(mainTextDigest.length).toBeGreaterThan(20);

    const patchPromise = page.waitForResponse(
      (res) =>
        res.request().method() === "PATCH" &&
        res.ok() &&
        res.url().includes(`/api/backoffice/content/pages/${encodeURIComponent(CANONICAL_SEED_PAGE_ID)}`),
      { timeout: 120_000 },
    );
    const workspaceSave = page
      .locator("header")
      .filter({ has: page.locator("h1") })
      .getByRole("button", { name: "Lagre", exact: true });
    await expect(workspaceSave).toBeEnabled({ timeout: 60_000 });
    await workspaceSave.click({ force: true });
    const patchRes = await patchPromise;
    expect(patchRes.ok(), `PATCH HTTP ${patchRes.status()}`).toBe(true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMainContent(page, { timeout: 30_000 });
    await assertProtectedShellReady(page);
    await dismissContentWorkspaceOnboardingIfPresent(page);
    await dismissEditorCoachmarkIfPresent(page);

    const sideNavAfter = page.getByRole("navigation", { name: "Høyre arbeidsflater" });
    await expect(sideNavAfter).toBeVisible({ timeout: 90_000 });
    await sideNavAfter.scrollIntoViewIfNeeded();
    await sideNavAfter.getByRole("button", { name: "AI", exact: true }).click();
    const aiRegionReloaded = page.getByRole("region", { name: "AI-assistent" });
    await expect(aiRegionReloaded).toBeVisible({ timeout: 15_000 });

    const mainTextDigestAfter = await page.evaluate(() => {
      const el = document.querySelector("main");
      const raw = el?.innerText ?? "";
      return raw.replace(/\s+/g, " ").trim().slice(0, 400);
    });
    expect(mainTextDigestAfter).toBe(mainTextDigest);

    const overlayDetected = (await page.locator("[data-nextjs-dialog]").count()) > 0;

    expect(consoleErrors, `consoleErrors: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `pageErrors: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(overlayDetected, "Next.js error overlay").toBe(false);
    expect(failedRequests, JSON.stringify(failedRequests)).toEqual([]);
  });

  test("remote_backend: login → content → AI tab → suggest or disabled (no broken targets)", async ({
    page,
    browserName,
    baseURL,
  }) => {
    test.setTimeout(480_000);
    test.skip(browserName !== "chromium", "Desktop proof only");
    /** Match getCmsRuntimeStatus(): unset / remote / 0 / false → remote_backend; avoid false skip when env is not the exact string "remote_backend". */
    test.skip(getCmsRuntimeStatus().mode !== "remote_backend", "Requires CMS remote_backend (LP_CMS_RUNTIME_MODE unset defaults to remote_backend)");

    const resolved = resolveBackofficeSuperadminCredentialsForE2E();
    test.skip(!resolved, "No canonical or E2E superadmin credentials resolved");
    test.skip(
      resolved.source !== "canonical_remote_backend_harness" && resolved.source !== "e2e_env",
      "Remote proof needs E2E superadmin or LP_REMOTE_BACKEND_AUTH_HARNESS=1",
    );

    const failedRequests: { url: string; status: number }[] = [];
    const { consoleErrors, pageErrors } = attachProofListeners(page, failedRequests);

    await loginViaForm(page, resolved.email, resolved.password, "/backoffice/content");
    await waitForPostLoginNavigation(page, { timeout: 90_000 });
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await assertProtectedShellReady(page);

    const healthRes = await page.request.get(`${baseURL}/api/health`);
    expect(healthRes.ok(), `health HTTP ${healthRes.status()}`).toBe(true);
    const healthJson = (await healthRes.json()) as { data?: { summary?: { runtime?: string } } };
    expect(healthJson?.data?.summary?.runtime).toBe("remote_backend");

    await page.goto(`${baseURL}/backoffice/content/${CANONICAL_SEED_PAGE_ID}`);
    await waitForMainContent(page, { timeout: 30_000 });
    await dismissContentWorkspaceOnboardingIfPresent(page);
    await dismissEditorCoachmarkIfPresent(page);

    const sideNav = page.getByRole("navigation", { name: "Høyre arbeidsflater" });
    await expect(sideNav).toBeVisible({ timeout: 90_000 });
    await sideNav.scrollIntoViewIfNeeded();
    await sideNav.getByRole("button", { name: "AI", exact: true }).click();

    const aiRegion = page.getByRole("region", { name: "AI-assistent" });
    await expect(aiRegion).toBeVisible({ timeout: 15_000 });

    const improveBtn = aiRegion.locator('[data-lp-editor-ai-improve="1"]');
    await expect(improveBtn).toBeVisible({ timeout: 10_000 });

    const unavailable = await aiRegion.getByText("AI er ikke tilgjengelig").isVisible().catch(() => false);
    if (unavailable) {
      await expect(improveBtn).toBeDisabled();
      const overlayUnavailable = (await page.locator("[data-nextjs-dialog]").count()) > 0;
      expect(consoleErrors, `consoleErrors: ${JSON.stringify(consoleErrors)}`).toEqual([]);
      expect(pageErrors, `pageErrors: ${JSON.stringify(pageErrors)}`).toEqual([]);
      expect(overlayUnavailable, "Next.js error overlay").toBe(false);
      expect(failedRequests, JSON.stringify(failedRequests)).toEqual([]);
      return;
    }

    await expect(improveBtn).toBeEnabled({ timeout: 10_000 });
    await improveBtn.scrollIntoViewIfNeeded();
    const suggestRes = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" && res.url().includes("/api/backoffice/ai/suggest"),
        { timeout: 300_000 },
      ),
      page.evaluate(() => {
        document.querySelector<HTMLButtonElement>('[data-lp-editor-ai-improve="1"]')?.click();
      }),
    ]).then(([res]) => res);
    expect(suggestRes.ok(), `suggest HTTP ${suggestRes.status()}`).toBe(true);
    const resJson = (await suggestRes.json()) as { ok?: boolean };
    expect(resJson?.ok).toBe(true);

    await expect(aiRegion.getByText(/AI oppdaterte innholdet/i)).toBeVisible({ timeout: 60_000 });

    const mainTextDigestRemote = await page.evaluate(() => {
      const el = document.querySelector("main");
      const raw = el?.innerText ?? "";
      return raw.replace(/\s+/g, " ").trim().slice(0, 400);
    });
    expect(mainTextDigestRemote.length).toBeGreaterThan(20);

    const patchPromiseRemote = page.waitForResponse(
      (res) =>
        res.request().method() === "PATCH" &&
        res.ok() &&
        res.url().includes(`/api/backoffice/content/pages/${encodeURIComponent(CANONICAL_SEED_PAGE_ID)}`),
      { timeout: 120_000 },
    );
    const workspaceSaveRemote = page
      .locator("header")
      .filter({ has: page.locator("h1") })
      .getByRole("button", { name: "Lagre", exact: true });
    await expect(workspaceSaveRemote).toBeEnabled({ timeout: 60_000 });
    await workspaceSaveRemote.click({ force: true });
    const patchResRemote = await patchPromiseRemote;
    expect(patchResRemote.ok(), `PATCH HTTP ${patchResRemote.status()}`).toBe(true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMainContent(page, { timeout: 30_000 });
    await assertProtectedShellReady(page);
    await dismissContentWorkspaceOnboardingIfPresent(page);
    await dismissEditorCoachmarkIfPresent(page);

    const sideNavRemote = page.getByRole("navigation", { name: "Høyre arbeidsflater" });
    await expect(sideNavRemote).toBeVisible({ timeout: 90_000 });
    await sideNavRemote.scrollIntoViewIfNeeded();
    await sideNavRemote.getByRole("button", { name: "AI", exact: true }).click();
    await expect(page.getByRole("region", { name: "AI-assistent" })).toBeVisible({ timeout: 15_000 });

    const mainTextDigestRemoteAfter = await page.evaluate(() => {
      const el = document.querySelector("main");
      const raw = el?.innerText ?? "";
      return raw.replace(/\s+/g, " ").trim().slice(0, 400);
    });
    expect(mainTextDigestRemoteAfter).toBe(mainTextDigestRemote);

    const overlayDetected = (await page.locator("[data-nextjs-dialog]").count()) > 0;
    expect(consoleErrors, `consoleErrors: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `pageErrors: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(overlayDetected, "Next.js error overlay").toBe(false);
    expect(failedRequests, JSON.stringify(failedRequests)).toEqual([]);
  });
});
