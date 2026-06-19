/**
 * Visual QA capture for /leverandor/meny — not part of CI.
 * Usage: node scripts/visual-qa/capture-provider-meny.mjs
 *
 * State semantics (LOCKED — do not mix in reports):
 * - Manglende Varmrett: dagens felles produksjonsrett mangler
 * - Manglende Enterprise-upgrade: varmrett finnes, upgrade-tillegg mangler
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { chromium } from "@playwright/test";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = resolve(process.cwd(), "docs/visual-qa/provider-meny");
const PASS =
  process.env.PLAYWRIGHT_TEST_PASSWORD ||
  process.env.E2E_TEST_USER_PASSWORD ||
  process.env.STAGING_TEST_PASSWORD ||
  "Lunchportalen123!";

const COPY = {
  missingVarmrettTitle: "Varmrett mangler",
  missingEnterpriseUpgradeTitle: "Upgrade mangler",
};

const LOGIN_CANDIDATES = [
  "kitchen-a@smoke.lunchportalen.no",
  process.env.E2E_PROVIDER_KITCHEN_EMAIL,
  process.env.PLAYWRIGHT_TEST_EMAIL,
]
  .map((email) => String(email ?? "").trim())
  .filter(Boolean)
  .map((email) => ({
    email,
    password: process.env.PLAYWRIGHT_TEST_PASSWORD || PASS,
  }));

function missingVarmrettHeroLocator(page) {
  return page.locator(".menu-day-card__hero.is-missing").filter({
    has: page.getByText(COPY.missingVarmrettTitle, { exact: true }),
  });
}

function missingEnterpriseUpgradeRowLocator(page) {
  return page.locator(".menu-day-card__upgrade-row").filter({
    has: page.getByText(COPY.missingEnterpriseUpgradeTitle, { exact: true }),
  });
}

function filledVarmrettMissingUpgradeDayLocator(page) {
  return page.locator(".menu-day-card").filter({
    has: page.locator(".menu-day-card__hero:not(.is-missing)"),
    hasNot: page.locator(".menu-day-card__hero.is-missing"),
    has: page.getByText(COPY.missingEnterpriseUpgradeTitle, { exact: true }),
  });
}

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function loginViaForm(page, email, password) {
  const next = encodeURIComponent("/leverandor/meny");
  await page.goto(`${BASE_URL}/login?next=${next}`, { waitUntil: "domcontentloaded", timeout: 60_000 });

  const emailInput = page.locator("#login-email");
  const passwordInput = page.locator("#login-password");
  const submitButton = page.getByRole("button", { name: /^logg inn$/i });

  await emailInput.waitFor({ state: "visible", timeout: 20_000 });
  await emailInput.click();
  await emailInput.fill("");
  await emailInput.pressSequentially(email, { delay: 5 });
  await passwordInput.click();
  await passwordInput.fill("");
  await passwordInput.pressSequentially(password, { delay: 5 });

  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 }),
    submitButton.click(),
  ]);
}

async function openMenu(page) {
  await page.goto(`${BASE_URL}/leverandor/meny`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector(".menu-week-cockpit", { timeout: 30_000 });
  await page.waitForSelector(".menu-production-rule", { timeout: 30_000 });
  await page.waitForSelector(".menu-day-card__hero", { timeout: 30_000 });
  await page.waitForTimeout(800);
}

async function weekLabel(page) {
  return page.locator(".menu-command-header__week-label").innerText().catch(() => "");
}

async function selectTier(page, label) {
  await page.locator(".menu-package-card").filter({ hasText: label }).click();
  await page.waitForTimeout(600);
}

async function capture(page, name, fullPage = true) {
  const path = resolve(OUT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage });
  return path;
}

async function measureMissingStates(page) {
  const missingVarmrettCount = await missingVarmrettHeroLocator(page).count();
  const missingEnterpriseUpgradeCount = await missingEnterpriseUpgradeRowLocator(page).count();
  const filledVarmrettWithMissingUpgradeCount = await filledVarmrettMissingUpgradeDayLocator(page).count();

  return {
    missingVarmrettCount,
    missingEnterpriseUpgradeCount,
    filledVarmrettWithMissingUpgradeCount,
    upgradeMissingOnVarmrettMissingDayCount: Math.max(
      0,
      missingEnterpriseUpgradeCount - filledVarmrettWithMissingUpgradeCount,
    ),
  };
}

async function verifyWorkspace(page) {
  const bodyText = await page.locator("body").innerText();
  const missingStates = await measureMissingStates(page);

  const cockpit = page.locator(".menu-week-cockpit");
  const cockpitVisible = (await cockpit.count()) > 0 && (await cockpit.first().isVisible());
  const cockpitNextStep = page.locator(".menu-week-cockpit__next-step");
  const cockpitNextStepVisible =
    (await cockpitNextStep.count()) > 0 && (await cockpitNextStep.first().isVisible());

  const productionRule = page.locator(".menu-production-rule");
  const productionRuleVisible =
    (await productionRule.count()) > 0 && (await productionRule.first().isVisible());

  return {
    cockpitDomPresent: cockpitVisible,
    cockpitNextStepVisible,
    cockpitPresent: cockpitVisible && cockpitNextStepVisible,
    productionRuleDomPresent: productionRuleVisible,
    productionRuleTitleVisible: bodyText.includes("Én felles varmrett per dag"),
    ...missingStates,
    missingVarmrettCopyVisible: missingStates.missingVarmrettCount > 0,
    missingEnterpriseUpgradeCopyVisible: missingStates.missingEnterpriseUpgradeCount > 0,
    noVarmmrettTypo: !/varmmrett/i.test(bodyText),
    noLoadingTextWithContent: !bodyText.includes("Laster meny"),
    idleLayoutWhenNoSelection:
      (await page.locator(".provider-menu-layout.is-inspector-idle").count()) > 0,
    enterpriseUpgradeFraming: bodyText.includes("Enterprise-upgrade"),
  };
}

async function verifyCockpitVarmrettAlignment(page) {
  const publishedValue = page
    .locator(".menu-week-cockpit__metric")
    .filter({ has: page.locator(".menu-week-cockpit__metric-label", { hasText: "Varmrett publisert" }) })
    .locator(".menu-week-cockpit__metric-value")
    .first();
  const cockpitPublished =
    (await publishedValue.count()) > 0 ? Number.parseInt(await publishedValue.innerText(), 10) || 0 : 0;
  const dayPublishedBadges = await page.locator(".menu-day-card__status.is-published").count();
  return {
    cockpitVarmrettPublishedCount: cockpitPublished,
    dayCardPublishedBadgeCount: dayPublishedBadges,
    cockpitVarmrettPublishedAligned: cockpitPublished === dayPublishedBadges,
  };
}
async function verifyEnterprisePackageBadge(page) {
  const activeEnterpriseCard = page.locator(".menu-package-card.is-active").filter({
    hasText: "Premium upgrade",
  });
  const badge = activeEnterpriseCard.locator(".menu-package-card__badge--rule");
  const badgeVisible =
    (await activeEnterpriseCard.count()) > 0 &&
    (await badge.count()) > 0 &&
    (await badge.first().isVisible());
  const badgeText = badgeVisible ? (await badge.first().innerText()).trim() : "";
  return {
    enterprisePackageRuleBadgeVisible: badgeVisible,
    enterprisePackageRuleBadgeText: badgeText,
    enterpriseUpgradeNotOwnProductionFraming:
      badgeText.toLowerCase().includes("ikke egen produksjonsrett"),
  };
}

async function verifyInspector(page, mode) {
  const inspector = page.locator(".menu-inspector.is-open");
  const open = (await inspector.count()) > 0 && (await inspector.first().isVisible());
  const bodyText = (await inspector.innerText().catch(() => "")).toLowerCase();

  if (mode === "varmrett") {
    return {
      inspectorOpen: open,
      sectionDagensVarmrett:
        bodyText.includes("dagens varmrett") ||
        (await inspector.locator(".menu-inspector__section--varmrett").count()) > 0,
      sectionOkonomi:
        bodyText.includes("økonomi") ||
        (await inspector.locator(".menu-inspector__section--economy").count()) > 0,
    };
  }

  return {
    inspectorOpen: open,
    sectionEnterpriseUpgrade:
      bodyText.includes("enterprise-upgrade") ||
      (await inspector.locator(".menu-inspector__section--enterprise").count()) > 0,
    notSeparateProduction:
      bodyText.includes("ikke opprett ny produksjonsrett") ||
      bodyText.includes("ikke opprett en ny produksjonsrett"),
  };
}

async function captureMissingVarmrettState(page, captures) {
  await selectTier(page, "Standard lunsjvalg");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const dayCards = page.locator(".menu-day-card");
    const cardCount = await dayCards.count();

    for (let i = 0; i < cardCount; i += 1) {
      const card = dayCards.nth(i);
      if (!(await card.isVisible())) continue;

      const hero = card.locator(".menu-day-card__hero.is-missing");
      if ((await hero.count()) === 0) continue;

      const title = (await card.locator(".menu-day-card__hero-title").innerText()).trim();
      if (title !== COPY.missingVarmrettTitle) continue;

      await card.scrollIntoViewIfNeeded();
      const cardPath = resolve(OUT_DIR, "04-missing-varmrett-day-card.png");
      await card.screenshot({ path: cardPath, timeout: 10_000 });
      captures.push(cardPath);

      const heroPath = resolve(OUT_DIR, "04-missing-varmrett-hero.png");
      try {
        await hero.screenshot({ path: heroPath, timeout: 5000 });
        captures.push(heroPath);
      } catch {
        // Day-card capture is authoritative; hero-only crop is optional.
      }

      return {
        captured: true,
        state: "missingVarmrett",
        tier: "BASIS",
        week: await weekLabel(page),
        copy: COPY.missingVarmrettTitle,
        files: [cardPath, ...(captures.includes(heroPath) ? [heroPath] : [])],
      };
    }

    await page.getByRole("button", { name: /Forrige/i }).click();
    await page.waitForTimeout(800);
  }

  return {
    captured: false,
    state: "missingVarmrett",
    tier: "BASIS",
    copy: COPY.missingVarmrettTitle,
    files: [],
  };
}

async function captureMissingEnterpriseUpgradeState(page, captures) {
  await selectTier(page, "Premium upgrade");

  const dayCards = page.locator(".menu-day-card");
  const cardCount = await dayCards.count();

  for (let i = 0; i < cardCount; i += 1) {
    const dayCard = dayCards.nth(i);
    if (!(await dayCard.isVisible())) continue;

    const heroMissing = dayCard.locator(".menu-day-card__hero.is-missing");
    if ((await heroMissing.count()) > 0) continue;

    const upgradeTitle = dayCard.locator(".menu-day-card__upgrade-title");
    if ((await upgradeTitle.count()) === 0) continue;
    if ((await upgradeTitle.innerText()).trim() !== COPY.missingEnterpriseUpgradeTitle) continue;

    await dayCard.scrollIntoViewIfNeeded();
    const cardPath = resolve(OUT_DIR, "04b-missing-enterprise-upgrade-day-card.png");
    await dayCard.screenshot({ path: cardPath });
    captures.push(cardPath);

    const upgradeRow = dayCard.locator(".menu-day-card__upgrade-row").first();
    const rowPath = resolve(OUT_DIR, "04b-missing-enterprise-upgrade-row.png");
    await upgradeRow.screenshot({ path: rowPath });
    captures.push(rowPath);

    return {
      captured: true,
      state: "missingEnterpriseUpgrade",
      tier: "ENTERPRISE",
      week: await weekLabel(page),
      copy: COPY.missingEnterpriseUpgradeTitle,
      requiresFilledVarmrett: true,
      files: [cardPath, rowPath],
    };
  }

  return {
    captured: false,
    state: "missingEnterpriseUpgrade",
    tier: "ENTERPRISE",
    week: await weekLabel(page),
    copy: COPY.missingEnterpriseUpgradeTitle,
    requiresFilledVarmrett: true,
    files: [],
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    throw new Error(`Dev server not reachable at ${BASE_URL}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let loggedIn = false;
  let usedEmail = null;
  const loginLog = [];

  for (const candidate of LOGIN_CANDIDATES) {
    try {
      await loginViaForm(page, candidate.email, candidate.password);
      await openMenu(page);
      loggedIn = true;
      usedEmail = candidate.email;
      break;
    } catch (err) {
      loginLog.push({ email: candidate.email, error: String(err) });
    }
  }

  if (!loggedIn) {
    await writeFile(resolve(OUT_DIR, "login-attempts.json"), JSON.stringify(loginLog, null, 2));
    await browser.close();
    throw new Error(`Could not reach /leverandor/meny. See ${OUT_DIR}/login-attempts.json`);
  }

  const captures = [];
  const phaseChecks = {};
  const stateCaptures = {};

  await selectTier(page, "Standard lunsjvalg");
  phaseChecks.basis = {
    ...(await verifyWorkspace(page)),
    ...(await verifyCockpitVarmrettAlignment(page)),
  };
  captures.push(await capture(page, "01-basis-full"));

  const cockpit = page.locator(".menu-week-cockpit");
  if (await cockpit.count()) {
    await cockpit.first().screenshot({ path: resolve(OUT_DIR, "01b-cockpit-basis.png") });
    captures.push(resolve(OUT_DIR, "01b-cockpit-basis.png"));
  }

  const productionRule = page.locator(".menu-production-rule");
  if (await productionRule.count()) {
    await productionRule.first().screenshot({ path: resolve(OUT_DIR, "01c-production-rule.png") });
    captures.push(resolve(OUT_DIR, "01c-production-rule.png"));
  }

  stateCaptures.missingVarmrett = await captureMissingVarmrettState(page, captures);
  await openMenu(page);

  await selectTier(page, "Flere valg for ansatte");
  phaseChecks.luxus = await verifyWorkspace(page);
  captures.push(await capture(page, "02-luxus-full"));

  await selectTier(page, "Premium upgrade");
  phaseChecks.enterprise = {
    ...(await verifyWorkspace(page)),
    ...(await verifyEnterprisePackageBadge(page)),
  };
  captures.push(await capture(page, "03-enterprise-full"));

  const enterpriseUpgradeRow = page.locator(".menu-day-card__upgrade-row").first();
  if (await enterpriseUpgradeRow.count()) {
    await enterpriseUpgradeRow.scrollIntoViewIfNeeded();
    await enterpriseUpgradeRow.screenshot({ path: resolve(OUT_DIR, "03c-enterprise-upgrade-row.png") });
    captures.push(resolve(OUT_DIR, "03c-enterprise-upgrade-row.png"));
  }

  const enterpriseCard = page.locator(".menu-package-card.is-active");
  if (await enterpriseCard.count()) {
    await enterpriseCard.first().screenshot({ path: resolve(OUT_DIR, "03b-enterprise-card.png") });
    captures.push(resolve(OUT_DIR, "03b-enterprise-card.png"));
  }

  stateCaptures.missingEnterpriseUpgrade = await captureMissingEnterpriseUpgradeState(page, captures);

  const filledHero = page.locator(".menu-day-card__hero:not(.is-missing)").first();
  if (await filledHero.count()) {
    await filledHero.scrollIntoViewIfNeeded();
    await filledHero.click();
    await page.waitForTimeout(600);
    phaseChecks.inspectorVarmrett = await verifyInspector(page, "varmrett");
  }

  const inspector = page.locator(".menu-inspector.is-open");
  if (await inspector.count()) {
    await inspector.first().screenshot({ path: resolve(OUT_DIR, "05b-inspector-varmrett-panel.png") });
    captures.push(resolve(OUT_DIR, "05b-inspector-varmrett-panel.png"));
  }

  captures.push(await capture(page, "05c-inspector-open-scroll"));

  const upgradeRow = page.locator(".menu-day-card__upgrade-row").first();
  if (await upgradeRow.count()) {
    await upgradeRow.click();
    await page.waitForTimeout(600);
    phaseChecks.inspectorEnterprise = await verifyInspector(page, "enterprise");
    if (await inspector.count()) {
      await inspector.first().screenshot({
        path: resolve(OUT_DIR, "06b-inspector-enterprise-upgrade-panel.png"),
      });
      captures.push(resolve(OUT_DIR, "06b-inspector-enterprise-upgrade-panel.png"));
    }
  }

  const bodyText = await page.locator("body").innerText();
  const varmrettFiles = new Set(stateCaptures.missingVarmrett.files ?? []);
  const upgradeFiles = new Set(stateCaptures.missingEnterpriseUpgrade.files ?? []);
  const overlapFiles = [...varmrettFiles].filter((f) => upgradeFiles.has(f));

  const report = {
    capturedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    loginEmail: usedEmail,
    captures,
    stateSemantics: {
      missingVarmrett: "Dagens felles produksjonsrett mangler — UI copy: «Varmrett mangler»",
      missingEnterpriseUpgrade:
        "Varmrett finnes på dagen, Enterprise-tillegg mangler — UI copy: «Upgrade mangler»",
    },
    stateCaptures,
    qaNotes: {
      captureMissingVarmrettMjs:
        "scripts/visual-qa/capture-missing-varmrett.mjs was a one-off manual ad-hoc script (NOT part of CI). " +
        "It threw TimeoutError on day-card screenshot due to an invalid filter locator. " +
        "The file has been REMOVED. Authoritative QA is ONLY capture-provider-meny.mjs.",
      doNotMixStates:
        "missingVarmrett and missingEnterpriseUpgrade use separate selectors, separate PNG files, and separate stateCaptures entries.",
    },
    phaseChecks,
    summary: {
      cockpitPresentAllTiers: ["basis", "luxus", "enterprise"].every(
        (t) => phaseChecks[t]?.cockpitPresent === true,
      ),
      productionRulePresentAllTiers: ["basis", "luxus", "enterprise"].every(
        (t) => phaseChecks[t]?.productionRuleDomPresent === true,
      ),
      noVarmmrettTypo: !/varmmrett/i.test(bodyText),
      usesVarmrettOnly: !/varmmrett/i.test(bodyText) && /varmrett/i.test(bodyText),
      basisIdleFullWidth: phaseChecks.basis?.idleLayoutWhenNoSelection === true,
      basisNoLoadingTextWithContent: phaseChecks.basis?.noLoadingTextWithContent === true,
      missingVarmrettStateCaptured: stateCaptures.missingVarmrett?.captured === true,
      missingEnterpriseUpgradeStateCaptured: stateCaptures.missingEnterpriseUpgrade?.captured === true,
      missingVarmrettAndUpgradeNotMixed:
        overlapFiles.length === 0 &&
        stateCaptures.missingVarmrett?.state === "missingVarmrett" &&
        stateCaptures.missingEnterpriseUpgrade?.state === "missingEnterpriseUpgrade" &&
        stateCaptures.missingEnterpriseUpgrade?.requiresFilledVarmrett === true,
      enterpriseUpgradeNotOwnProductionFraming:
        phaseChecks.enterprise?.enterpriseUpgradeNotOwnProductionFraming === true,
      cockpitVarmrettPublishedAligned: phaseChecks.basis?.cockpitVarmrettPublishedAligned === true,
      inspectorVarmrettOk:
        phaseChecks.inspectorVarmrett?.inspectorOpen === true &&
        phaseChecks.inspectorVarmrett?.sectionDagensVarmrett === true,
      inspectorEnterpriseOk:
        phaseChecks.inspectorEnterprise?.inspectorOpen === true &&
        phaseChecks.inspectorEnterprise?.sectionEnterpriseUpgrade === true,
    },
  };

  await writeFile(resolve(OUT_DIR, "visual-qa-report.json"), JSON.stringify(report, null, 2));
  await browser.close();

  console.log(JSON.stringify(report, null, 2));

  if (!report.summary.cockpitPresentAllTiers) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
