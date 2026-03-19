// e2e/ai-cms.e2e.ts — E2E proof that CMS AI flows work: apply→save→persist, metrics, failure fallback.
// AGENTS.md: move AI from "strong architecture" to "proven functionality". No security weakening; minimal hooks.

import { test, expect } from "@playwright/test";
import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
  type E2ERole,
} from "./helpers/auth";
import { assertProtectedShellReady, waitForMainContent } from "./helpers/ready";

const hasSuperadminCreds =
  !!(process.env.E2E_SUPERADMIN_EMAIL && process.env.E2E_SUPERADMIN_PASSWORD) ||
  !!(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

function requireSuperadmin() {
  const creds = getCredentialsForRole("superadmin" as E2ERole);
  if (!creds) {
    throw new Error(
      "Missing superadmin credentials. Set E2E_SUPERADMIN_EMAIL/PASSWORD or E2E_TEST_USER_EMAIL/PASSWORD."
    );
  }
  return creds;
}

test.describe("CMS AI — suggestion apply → save → reload → persisted", () => {
  test.skip(!hasSuperadminCreds, "Superadmin credentials required for backoffice");

  test("SEO suggestion apply, save, reload: change is persisted in page body", async ({
    page,
    baseURL,
  }) => {
    const { email, password } = requireSuperadmin();
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await assertProtectedShellReady(page);

    // Create a page via API (same session) so we have a known page with empty meta → SEO will suggest title
    const createRes = await page.request.post(`${baseURL}/api/backoffice/content/pages`, {
      data: { title: "E2E AI Test Page" },
      headers: { "Content-Type": "application/json" },
    });
    const createPayload = (await createRes.json()) as {
      ok?: boolean;
      data?: { page?: { id: string } };
      error?: string;
    };
    if (!createRes.ok() || !createPayload?.ok || !createPayload?.data?.page?.id) {
      throw new Error(
        `Create page failed: ${createRes.status()} ${JSON.stringify(createPayload)}`
      );
    }
    const pageId = createPayload.data!.page!.id;

    await page.goto(`${baseURL}/backoffice/content/${pageId}`);
    await waitForMainContent(page, { timeout: 15_000 });
    const main = page.getByRole("main");
    await expect(main).toBeVisible({ timeout: 15_000 });

    // Wait for editor shell: AI-assistent section and Lagre button
    const aiSection = page.getByRole("region", { name: "AI-assistent" }).or(page.locator('section[aria-label="AI-assistent"]'));
    await aiSection.waitFor({ state: "visible", timeout: 15_000 });
    const runAnalysisBtn = page.getByRole("button", { name: "Kjør sideanalyse" });
    await expect(runAnalysisBtn).toBeVisible();

    await runAnalysisBtn.click();
    await page.waitForTimeout(2500);

    const recommendationsList = page.getByRole("list", { name: "Anbefalinger" });
    await recommendationsList.waitFor({ state: "visible", timeout: 20_000 });
    const firstBruk = page.getByRole("button", { name: /^Bruk/ }).first();
    await expect(firstBruk).toBeVisible({ timeout: 5_000 });
    await firstBruk.click();

    const saveBtn = page.getByRole("button", { name: /^Lagre$/ });
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();
    await expect(page.getByText(/Sist lagret/)).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMainContent(page, { timeout: 15_000 });

    const getRes = await page.request.get(
      `${baseURL}/api/backoffice/content/pages/${pageId}`
    );
    const getPayload = (await getRes.json()) as {
      ok?: boolean;
      data?: { page?: { body?: Record<string, unknown> } };
    };
    expect(getRes.ok()).toBe(true);
    expect(getPayload?.ok).toBe(true);
    const body = getPayload?.data?.page?.body;
    const meta = body && typeof body === "object" ? (body.meta as Record<string, unknown> | undefined) : undefined;
    const seo = meta && typeof meta === "object" ? (meta.seo as Record<string, unknown> | undefined) : undefined;
    const seoTitle = seo && typeof seo === "object" && typeof seo.title === "string" ? seo.title : "";
    expect(seoTitle.length > 0).toBe(true);
    expect(seoTitle).toMatch(/Firmalunsj|E2E AI Test Page/);
  });
});

// Page builder: full path through normal CMS save chain (no mock of save or persistence).
test.describe("CMS AI — page builder → append/replace → normal save → persisted", () => {
  test.skip(!hasSuperadminCreds, "Superadmin credentials required for backoffice");

  test("page builder (Kontakt) → append → Lagre → GET: blocks persisted; reload → GET again: structure durable", async ({
    page,
    baseURL,
  }) => {
    const { email, password } = requireSuperadmin();
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await assertProtectedShellReady(page);

    const createRes = await page.request.post(`${baseURL}/api/backoffice/content/pages`, {
      data: { title: "E2E Page Builder Test" },
      headers: { "Content-Type": "application/json" },
    });
    const createPayload = (await createRes.json()) as {
      ok?: boolean;
      data?: { page?: { id: string } };
    };
    if (!createRes.ok() || !createPayload?.ok || !createPayload?.data?.page?.id) {
      throw new Error(`Create page failed: ${createRes.status()} ${JSON.stringify(createPayload)}`);
    }
    const pageId = createPayload.data!.page!.id;

    await page.goto(`${baseURL}/backoffice/content/${pageId}`);
    await waitForMainContent(page, { timeout: 15_000 });
    await expect(page.getByRole("main")).toBeVisible({ timeout: 15_000 });

    const pageComposerHeading = page.getByText("AI Page Composer", { exact: true });
    await pageComposerHeading.scrollIntoViewIfNeeded().catch(() => {});
    await pageComposerHeading.waitFor({ state: "visible", timeout: 10_000 });

    const detailsSummary = page.getByText("Strukturt intent (valgfritt)", { exact: true });
    await detailsSummary.click();
    await page.waitForTimeout(300);

    const sidetypeSelect = page.getByRole("combobox", { name: /Sidetype/i });
    await sidetypeSelect.waitFor({ state: "visible", timeout: 5_000 });
    await sidetypeSelect.selectOption({ label: "Kontakt" });

    const genererBtn = page.getByRole("button", { name: "Generer side" });
    await expect(genererBtn).toBeEnabled({ timeout: 5_000 });
    await genererBtn.click();
    await page.waitForTimeout(3500);

    const leggTilUnderBtn = page.getByRole("button", { name: "Legg til under" });
    await leggTilUnderBtn.waitFor({ state: "visible", timeout: 15_000 });
    await leggTilUnderBtn.click();

    const saveBtn = page.getByRole("button", { name: /^Lagre$/ });
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();
    await expect(page.getByText(/Sist lagret/)).toBeVisible({ timeout: 15_000 });

    const getRes = await page.request.get(`${baseURL}/api/backoffice/content/pages/${pageId}`);
    const getPayload = (await getRes.json()) as {
      ok?: boolean;
      data?: { page?: { body?: { blocks?: Array<{ type?: string }> } } };
    };
    expect(getRes.ok()).toBe(true);
    expect(getPayload?.ok).toBe(true);
    const blocks = getPayload?.data?.page?.body?.blocks;
    expect(Array.isArray(blocks)).toBe(true);
    const blockList = blocks as Array<{ type?: string }>;
    expect(blockList.length).toBe(3);
    const types = blockList.map((b) => (b && typeof b.type === "string" ? b.type : "")).filter(Boolean);
    expect(types).toContain("hero");
    expect(types).toContain("richText");
    expect(types).toContain("cta");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMainContent(page, { timeout: 15_000 });

    const getAfterReload = await page.request.get(`${baseURL}/api/backoffice/content/pages/${pageId}`);
    const payloadAfterReload = (await getAfterReload.json()) as {
      ok?: boolean;
      data?: { page?: { body?: { blocks?: Array<{ type?: string }> } } };
    };
    expect(getAfterReload.ok()).toBe(true);
    const blocksAfterReload = payloadAfterReload?.data?.page?.body?.blocks;
    expect(Array.isArray(blocksAfterReload)).toBe(true);
    expect((blocksAfterReload as unknown[]).length).toBe(3);
    const typesAfterReload = (blocksAfterReload as Array<{ type?: string }>).map((b) => (b?.type ?? "")).filter(Boolean);
    expect(typesAfterReload).toContain("hero");
    expect(typesAfterReload).toContain("richText");
    expect(typesAfterReload).toContain("cta");
  });

  test("page builder (Priser) → replace → Lagre → GET: replaced structure persisted (same save chain)", async ({
    page,
    baseURL,
  }) => {
    const { email, password } = requireSuperadmin();
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await assertProtectedShellReady(page);

    const createRes = await page.request.post(`${baseURL}/api/backoffice/content/pages`, {
      data: { title: "E2E Page Builder Replace Test" },
      headers: { "Content-Type": "application/json" },
    });
    const createPayload = (await createRes.json()) as { ok?: boolean; data?: { page?: { id: string } } };
    if (!createRes.ok() || !createPayload?.ok || !createPayload?.data?.page?.id) {
      throw new Error(`Create page failed: ${createRes.status()}`);
    }
    const pageId = createPayload.data!.page!.id;

    await page.goto(`${baseURL}/backoffice/content/${pageId}`);
    await waitForMainContent(page, { timeout: 15_000 });
    await expect(page.getByRole("main")).toBeVisible({ timeout: 15_000 });

    const pageComposerHeading = page.getByText("AI Page Composer", { exact: true });
    await pageComposerHeading.scrollIntoViewIfNeeded().catch(() => {});
    await pageComposerHeading.waitFor({ state: "visible", timeout: 10_000 });

    await page.getByText("Strukturt intent (valgfritt)", { exact: true }).click();
    await page.waitForTimeout(300);

    const sidetypeSelect = page.getByRole("combobox", { name: /Sidetype/i });
    await sidetypeSelect.waitFor({ state: "visible", timeout: 5_000 });
    await sidetypeSelect.selectOption({ label: "Priser" });

    const genererBtn = page.getByRole("button", { name: "Generer side" });
    await expect(genererBtn).toBeEnabled({ timeout: 5_000 });
    await genererBtn.click();
    await page.waitForTimeout(3500);

    page.once("dialog", (d) => d.accept());
    const erstattBtn = page.getByRole("button", { name: "Erstatt innhold" });
    await erstattBtn.waitFor({ state: "visible", timeout: 15_000 });
    await erstattBtn.click();

    const saveBtn = page.getByRole("button", { name: /^Lagre$/ });
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();
    await expect(page.getByText(/Sist lagret/)).toBeVisible({ timeout: 15_000 });

    const getRes = await page.request.get(`${baseURL}/api/backoffice/content/pages/${pageId}`);
    const getPayload = (await getRes.json()) as {
      ok?: boolean;
      data?: { page?: { body?: { blocks?: Array<{ type?: string }> } } };
    };
    expect(getRes.ok()).toBe(true);
    expect(getPayload?.ok).toBe(true);
    const blocks = getPayload?.data?.page?.body?.blocks;
    expect(Array.isArray(blocks)).toBe(true);
    expect((blocks as unknown[]).length).toBe(3);
    const types = (blocks as Array<{ type?: string }>).map((b) => (b?.type ?? "")).filter(Boolean);
    expect(types).toContain("hero");
    expect(types).toContain("richText");
    expect(types).toContain("cta");
  });
});

test.describe("CMS AI — metrics sent when analysis runs", () => {
  test.skip(!hasSuperadminCreds, "Superadmin credentials required");

  test("running SEO analysis triggers metrics request to editor-ai/metrics", async ({
    page,
    baseURL,
  }) => {
    const { email, password } = requireSuperadmin();
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await assertProtectedShellReady(page);

    const metricsRequests: { url: string; postData: string }[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/editor-ai/metrics")) {
        metricsRequests.push({ url: req.url(), postData: req.postData() ?? "" });
      }
    });

    const createRes = await page.request.post(`${baseURL}/api/backoffice/content/pages`, {
      data: { title: "E2E AI Metrics Test" },
      headers: { "Content-Type": "application/json" },
    });
    const createPayload = (await createRes.json()) as { ok?: boolean; data?: { page?: { id: string } } };
    if (!createRes.ok() || !createPayload?.data?.page?.id) {
      throw new Error("Create page failed for metrics test");
    }
    const pageId = createPayload.data!.page!.id;
    await page.goto(`${baseURL}/backoffice/content/${pageId}`);
    await waitForMainContent(page, { timeout: 15_000 });

    const runBtn = page.getByRole("button", { name: "Kjør sideanalyse" });
    await runBtn.waitFor({ state: "visible", timeout: 10_000 });
    await runBtn.click();
    await page.waitForTimeout(3000);

    const hasMetrics =
      metricsRequests.length > 0 &&
      metricsRequests.some((r) => {
        try {
          const body = JSON.parse(r.postData || "{}") as { type?: string; feature?: string };
          return (
            body.type === "ai_action_triggered" ||
            body.type === "ai_result_received" ||
            body.feature === "seo_intelligence"
          );
        } catch {
          return false;
        }
      });
    expect(hasMetrics).toBe(true);
  });
});

test.describe("CMS AI — unsafe output blocked or sanitized", () => {
  test.skip(!hasSuperadminCreds, "Superadmin credentials required for backoffice");

  test("intercepted page-builder with script tag: no execution in DOM, editor usable, unsafe not persisted", async ({
    page,
    baseURL,
  }) => {
    const UNSAFE_MARKER = "__E2E_UNSAFE_MARKER";
    const unsafePayload = {
      ok: true,
      data: {
        title: "E2E unsafe test",
        summary: "",
        blocks: [
          {
            id: "blk_unsafe_1",
            type: "richText",
            data: {
              heading: "Unsafe test",
              body: `<script>window.${UNSAFE_MARKER}=true</script>`,
            },
          },
        ],
      },
    };

    await page.route("**/api/backoffice/ai/page-builder", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(unsafePayload),
        });
      } else {
        await route.continue();
      }
    });

    const { email, password } = requireSuperadmin();
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await assertProtectedShellReady(page);

    const createRes = await page.request.post(`${baseURL}/api/backoffice/content/pages`, {
      data: { title: "E2E Unsafe Output Test" },
      headers: { "Content-Type": "application/json" },
    });
    const createPayload = (await createRes.json()) as { ok?: boolean; data?: { page?: { id: string } } };
    if (!createRes.ok() || !createPayload?.data?.page?.id) {
      throw new Error("Create page failed for unsafe-output test");
    }
    const pageId = createPayload.data!.page!.id;
    await page.goto(`${baseURL}/backoffice/content/${pageId}`);
    await waitForMainContent(page, { timeout: 15_000 });

    const pageComposerHeading = page.getByText("AI Page Composer", { exact: true });
    await pageComposerHeading.scrollIntoViewIfNeeded().catch(() => {});
    await pageComposerHeading.waitFor({ state: "visible", timeout: 10_000 });

    await page.getByText("Strukturt intent (valgfritt)", { exact: true }).click();
    await page.waitForTimeout(300);

    const sidetypeSelect = page.getByRole("combobox", { name: /Sidetype/i });
    await sidetypeSelect.waitFor({ state: "visible", timeout: 5_000 });
    await sidetypeSelect.selectOption({ label: "Kontakt" });

    const genererBtn = page.getByRole("button", { name: "Generer side" });
    await expect(genererBtn).toBeEnabled({ timeout: 5_000 });
    await genererBtn.click();
    await page.waitForTimeout(3500);

    const leggTilUnderBtn = page.getByRole("button", { name: "Legg til under" });
    await leggTilUnderBtn.waitFor({ state: "visible", timeout: 15_000 });
    await leggTilUnderBtn.click();
    await page.waitForTimeout(500);

    // 1) Unsafe content does not execute and does not appear in DOM in executable form
    const unsafeDidNotExecute = await page.evaluate((marker) => {
      if (typeof (window as unknown as Record<string, unknown>)[marker] !== "undefined") return false;
      const scripts = document.querySelectorAll("script");
      for (let i = 0; i < scripts.length; i++) {
        const content = (scripts[i].textContent || scripts[i].innerHTML || "").trim();
        if (content.includes(marker)) return false;
      }
      return true;
    }, UNSAFE_MARKER);
    expect(unsafeDidNotExecute).toBe(true);

    // 2) Editor remains stable and usable
    await expect(page.getByRole("main")).toBeVisible();
    const aiSection = page.getByRole("region", { name: "AI-assistent" }).or(page.locator('section[aria-label="AI-assistent"]'));
    await expect(aiSection).toBeVisible();
    const saveBtn = page.getByRole("button", { name: /^Lagre$/ });
    await expect(saveBtn).toBeEnabled();

    // 3) Save and verify unsafe content is not persisted (sanitized before apply → not in saved body)
    await saveBtn.click();
    await expect(page.getByText(/Sist lagret/)).toBeVisible({ timeout: 15_000 });

    const getRes = await page.request.get(`${baseURL}/api/backoffice/content/pages/${pageId}`);
    const getPayload = (await getRes.json()) as {
      ok?: boolean;
      data?: { page?: { body?: { blocks?: Array<{ type?: string; data?: Record<string, unknown> }> } } };
    };
    expect(getRes.ok()).toBe(true);
    expect(getPayload?.ok).toBe(true);
    const blocks = getPayload?.data?.page?.body?.blocks ?? [];
    for (const block of blocks) {
      const body = block?.data?.body;
      if (typeof body === "string") {
        expect(body).not.toMatch(/<script\b/i);
        expect(body).not.toContain(UNSAFE_MARKER);
      }
    }
  });

  test("page-builder API returns 400 AI_SAFETY_REJECTED: editor safe-fails and stays usable", async ({
    page,
    baseURL,
  }) => {
    await page.route("**/api/backoffice/ai/page-builder", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ok: false,
            error: "AI_SAFETY_REJECTED",
            message: "AI response contained unsafe content and was rejected.",
          }),
        });
      } else {
        await route.continue();
      }
    });

    const { email, password } = requireSuperadmin();
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await assertProtectedShellReady(page);

    const createRes = await page.request.post(`${baseURL}/api/backoffice/content/pages`, {
      data: { title: "E2E Safe-Fail Test" },
      headers: { "Content-Type": "application/json" },
    });
    const createPayload = (await createRes.json()) as { ok?: boolean; data?: { page?: { id: string } } };
    if (!createRes.ok() || !createPayload?.data?.page?.id) {
      throw new Error("Create page failed for safe-fail test");
    }
    const pageId = createPayload.data!.page!.id;
    await page.goto(`${baseURL}/backoffice/content/${pageId}`);
    await waitForMainContent(page, { timeout: 15_000 });

    const pageComposerHeading = page.getByText("AI Page Composer", { exact: true });
    await pageComposerHeading.scrollIntoViewIfNeeded().catch(() => {});
    await pageComposerHeading.waitFor({ state: "visible", timeout: 10_000 });

    await page.getByText("Strukturt intent (valgfritt)", { exact: true }).click();
    await page.waitForTimeout(300);

    const sidetypeSelect = page.getByRole("combobox", { name: /Sidetype/i });
    await sidetypeSelect.waitFor({ state: "visible", timeout: 5_000 });
    await sidetypeSelect.selectOption({ label: "Kontakt" });

    const genererBtn = page.getByRole("button", { name: "Generer side" });
    await expect(genererBtn).toBeEnabled({ timeout: 5_000 });
    await genererBtn.click();
    await page.waitForTimeout(4000);

    // No "Legg til under" / "Erstatt innhold" (no result to apply); error surfaced
    const leggTilUnder = page.getByRole("button", { name: "Legg til under" });
    await expect(leggTilUnder).not.toBeVisible();

    // Editor remains usable
    await expect(page.getByRole("main")).toBeVisible();
    const aiSection = page.getByRole("region", { name: "AI-assistent" }).or(page.locator('section[aria-label="AI-assistent"]'));
    await expect(aiSection).toBeVisible();
    await expect(page.getByRole("button", { name: /^Lagre$/ })).toBeEnabled();
  });

  test("intercepted page-builder with event handler and javascript: URL: sanitized, no execution, editor usable", async ({
    page,
    baseURL,
  }) => {
    const ONERROR_MARKER = "__E2E_ONERROR_MARKER";
    const unsafePayload = {
      ok: true,
      data: {
        title: "E2E unsafe events",
        summary: "",
        blocks: [
          {
            id: "blk_evt_1",
            type: "richText",
            data: {
              heading: "Unsafe",
              body: `<img src=x onerror="window.${ONERROR_MARKER}=true"> <a href="javascript:void(window.${ONERROR_MARKER}=true)">click</a>`,
            },
          },
        ],
      },
    };

    await page.route("**/api/backoffice/ai/page-builder", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(unsafePayload),
        });
      } else {
        await route.continue();
      }
    });

    const { email, password } = requireSuperadmin();
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await assertProtectedShellReady(page);

    const createRes = await page.request.post(`${baseURL}/api/backoffice/content/pages`, {
      data: { title: "E2E Unsafe Events Test" },
      headers: { "Content-Type": "application/json" },
    });
    const createPayload = (await createRes.json()) as { ok?: boolean; data?: { page?: { id: string } } };
    if (!createRes.ok() || !createPayload?.data?.page?.id) {
      throw new Error("Create page failed for unsafe-events test");
    }
    const pageId = createPayload.data!.page!.id;
    await page.goto(`${baseURL}/backoffice/content/${pageId}`);
    await waitForMainContent(page, { timeout: 15_000 });

    const pageComposerHeading = page.getByText("AI Page Composer", { exact: true });
    await pageComposerHeading.scrollIntoViewIfNeeded().catch(() => {});
    await pageComposerHeading.waitFor({ state: "visible", timeout: 10_000 });

    await page.getByText("Strukturt intent (valgfritt)", { exact: true }).click();
    await page.waitForTimeout(300);

    const sidetypeSelect = page.getByRole("combobox", { name: /Sidetype/i });
    await sidetypeSelect.waitFor({ state: "visible", timeout: 5_000 });
    await sidetypeSelect.selectOption({ label: "Kontakt" });

    const genererBtn = page.getByRole("button", { name: "Generer side" });
    await expect(genererBtn).toBeEnabled({ timeout: 5_000 });
    await genererBtn.click();
    await page.waitForTimeout(3500);

    const leggTilUnderBtn = page.getByRole("button", { name: "Legg til under" });
    await leggTilUnderBtn.waitFor({ state: "visible", timeout: 15_000 });
    await leggTilUnderBtn.click();
    await page.waitForTimeout(500);

    const markerDidNotExecute = await page.evaluate((marker) => {
      return typeof (window as unknown as Record<string, unknown>)[marker] === "undefined";
    }, ONERROR_MARKER);
    expect(markerDidNotExecute).toBe(true);

    await expect(page.getByRole("main")).toBeVisible();
    const aiSection = page.getByRole("region", { name: "AI-assistent" }).or(page.locator('section[aria-label="AI-assistent"]'));
    await expect(aiSection).toBeVisible();
    await expect(page.getByRole("button", { name: /^Lagre$/ })).toBeEnabled();
  });
});

test.describe("CMS AI — failure safe fallback", () => {
  test.skip(!hasSuperadminCreds, "Superadmin credentials required");

  test("when SEO intelligence API returns 500, editor stays usable and does not crash", async ({
    page,
    baseURL,
  }) => {
    const { email, password } = requireSuperadmin();
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await assertProtectedShellReady(page);

    await page.route("**/api/backoffice/ai/seo-intelligence", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 500, body: JSON.stringify({ ok: false, error: "Server error" }) });
      } else {
        await route.continue();
      }
    });

    const createRes = await page.request.post(`${baseURL}/api/backoffice/content/pages`, {
      data: { title: "E2E AI Failure Test" },
      headers: { "Content-Type": "application/json" },
    });
    const createPayload = (await createRes.json()) as { ok?: boolean; data?: { page?: { id: string } } };
    if (!createRes.ok() || !createPayload?.data?.page?.id) {
      throw new Error("Create page failed for failure test");
    }
    const pageId = createPayload.data!.page!.id;
    await page.goto(`${baseURL}/backoffice/content/${pageId}`);
    await waitForMainContent(page, { timeout: 15_000 });

    const runBtn = page.getByRole("button", { name: "Kjør sideanalyse" });
    await runBtn.waitFor({ state: "visible", timeout: 10_000 });
    await runBtn.click();
    await page.waitForTimeout(4000);

    await expect(page.getByRole("main")).toBeVisible();
    const aiSection = page.getByRole("region", { name: "AI-assistent" }).or(page.locator('section[aria-label="AI-assistent"]'));
    await expect(aiSection).toBeVisible();
    await expect(runBtn).toBeVisible();
  });
});
