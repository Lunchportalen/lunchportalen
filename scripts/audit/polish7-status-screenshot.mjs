/**
 * Static visual preview for TPT-B-7c polish-7 (local screenshot only).
 * Run: node scripts/audit/polish7-status-screenshot.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outDir = path.join(root, ".screenshots");
const htmlPath = path.join(outDir, "tpt-b7c-polish7-preview.html");
const pngPath = path.join(outDir, "tpt-b7c-polish7-desktop.png");
const mobilePath = path.join(outDir, "tpt-b7c-polish7-mobile.png");

const previewHtml = `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TPT-B-7c polish-7 preview</title>
  <link rel="stylesheet" href="../../app/styles/ds/design-system.css" />
  <style>
    body { margin: 0; background: #faf8f4; font-family: Inter, system-ui, sans-serif; }
    .ds-page { padding-bottom: 80px; }
    .ds-container { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
  </style>
</head>
<body>
  <main class="ds-page">
    <div class="ds-container">
      <header class="ds-section">
        <p class="ds-eyebrow">Tripletex</p>
        <h1 class="ds-h2">Tilkoblingsstatus</h1>
        <p class="ds-lead">Oversikt over tilkobling, webhook og nylig aktivitet.</p>
      </header>
      <div class="ds-tripletex-status">
        <div class="ds-tripletex-status__hero">
          <div class="ds-tripletex-status__hero-strip">
            <span class="ds-status-badge ds-status-badge--configuring">Konfigurerer…</span>
            <p class="ds-body-sm ds-tripletex-status__hero-meta">Siden 22. mai 2026, 13:11 · Smoke Provider AS (114612665)</p>
            <a class="ds-btn ds-btn--primary ds-tripletex-status__hero-cta" href="#">Konfigurer webhook →</a>
          </div>
        </div>
        <section class="ds-tripletex-status__section">
          <h2 class="ds-h3">Ressurser i Tripletex</h2>
          <div class="ds-cards-3 ds-tripletex-status__resource-grid">
            <article class="ds-card ds-tripletex-status__resource-card">
              <p class="ds-eyebrow">Produkter</p>
              <p class="ds-tripletex-status__stat-number">3</p>
              <p class="ds-body-sm ds-tripletex-status__text-soft">Mappede måltidsprodukter</p>
            </article>
            <article class="ds-card ds-tripletex-status__resource-card">
              <p class="ds-eyebrow">Kunder</p>
              <p class="ds-tripletex-status__stat-number">1</p>
              <p class="ds-body-sm ds-tripletex-status__text-soft">Firma-koblinger i Tripletex</p>
            </article>
            <article class="ds-card ds-tripletex-status__resource-card">
              <p class="ds-eyebrow">MVA-koder</p>
              <p class="ds-tripletex-status__stat-number">2</p>
              <p class="ds-body-sm ds-tripletex-status__text-soft">Unike avgiftskoder i bruk</p>
            </article>
          </div>
        </section>
        <section class="ds-tripletex-status__section">
          <h2 class="ds-h3">Webhook</h2>
          <dl class="ds-tripletex-status__def-list">
            <div class="ds-tripletex-status__def-row"><dt class="ds-body-sm ds-tripletex-status__text-soft">Siste mottatt</dt><dd class="ds-body">Ingen hendelser ennå</dd></div>
            <div class="ds-tripletex-status__def-row"><dt class="ds-body-sm ds-tripletex-status__text-soft">Siste 30 dager</dt><dd class="ds-body">0 hendelser</dd></div>
            <div class="ds-tripletex-status__def-row"><dt class="ds-body-sm ds-tripletex-status__text-soft">Secret rotert</dt><dd class="ds-body">22. mai 2026, 13:11</dd></div>
          </dl>
          <div class="ds-tripletex-status__copy-field">
            <code class="ds-tripletex-status__copy-field-value">https://staging.app.lunchportalen.no/api/webhooks/tripletex/provider/742c7d6c-3632-4362-a665-da0e415aab8c</code>
            <button type="button" class="ds-tripletex-status__copy-field-btn">Kopier</button>
          </div>
        </section>
        <section class="ds-tripletex-status__section">
          <h2 class="ds-h3">Aktivitet siste 30 dager</h2>
          <div class="ds-tripletex-status__activity-stats">
            <div class="ds-tripletex-status__activity-stat"><p class="ds-tripletex-status__stat-number">0</p><p class="ds-body-sm ds-tripletex-status__text-soft">Fakturaer sendt</p></div>
            <div class="ds-tripletex-status__activity-stat"><p class="ds-tripletex-status__stat-number">0</p><p class="ds-body-sm ds-tripletex-status__text-soft">Fakturaer betalt</p></div>
            <div class="ds-tripletex-status__activity-stat"><p class="ds-tripletex-status__stat-number">0</p><p class="ds-body-sm ds-tripletex-status__text-soft">Feilede pushes</p></div>
            <div class="ds-tripletex-status__activity-stat"><p class="ds-tripletex-status__stat-number">0</p><p class="ds-body-sm ds-tripletex-status__text-soft">Webhooks</p></div>
          </div>
          <h3 class="ds-body-sm ds-tripletex-status__feed-heading">Siste hendelser</h3>
          <ol class="ds-tripletex-status__activity-list">
            <li class="ds-tripletex-status__activity-row"><span class="ds-tripletex-status__activity-icon ds-tripletex-status__activity-icon--success">✓</span><span class="ds-body">Oppsett fullført</span><time class="ds-tripletex-status__activity-time">22. mai 2026, 13:14</time></li>
            <li class="ds-tripletex-status__activity-row"><span class="ds-tripletex-status__activity-icon ds-tripletex-status__activity-icon--warn">!</span><span class="ds-body">Kunde hoppet over</span><time class="ds-tripletex-status__activity-time">22. mai 2026, 13:11</time></li>
          </ol>
        </section>
        <section class="ds-tripletex-status__section">
          <h2 class="ds-h3">Handlinger</h2>
          <div class="ds-tripletex-status__actions">
            <p class="ds-body-sm ds-tripletex-status__text-soft">Kun provider-admin kan utføre disse handlingene.</p>
            <div class="ds-tripletex-status__action-buttons">
              <button type="button" class="ds-btn ds-btn--secondary">Test tilkobling</button>
              <button type="button" class="ds-btn ds-btn--secondary">Roter webhook-secret</button>
              <button type="button" class="ds-tripletex-status__destructive-link">Koble fra →</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </main>
</body>
</html>`;

await mkdir(outDir, { recursive: true });
await writeFile(htmlPath, previewHtml, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`);
await page.setViewportSize({ width: 1280, height: 1400 });
await page.screenshot({ path: pngPath, fullPage: true });
await page.setViewportSize({ width: 380, height: 1600 });
await page.screenshot({ path: mobilePath, fullPage: true });
await browser.close();

console.log(JSON.stringify({ htmlPath, pngPath, mobilePath }, null, 2));
