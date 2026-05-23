#!/usr/bin/env node
/**
 * Wrapper: loads smoke credentials from .env.local, runs k6 with JSON output.
 *
 * Usage:
 *   node scripts/k6/run.mjs
 *   node scripts/k6/run.mjs -- smoke only
 *   K6_FASES=smoke,baseline node scripts/k6/run.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RESULTS_DIR = path.join(ROOT, 'scripts', 'k6', 'results');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function resolveBaseUrl(envLocal) {
  if (process.env.K6_BASE_URL) {
    return process.env.K6_BASE_URL.replace(/\/$/, '');
  }
  const tagEnv = process.env.K6_TAG_ENV || 'prod';
  if (tagEnv === 'staging') {
    // git-staging deploy — Vercel bypass works reliably (see dc-011-smoke)
    return (
      envLocal.K6_STAGING_BASE_URL ||
      'https://lunchportalen-git-staging-lunchportalen.vercel.app'
    ).replace(/\/$/, '');
  }
  return 'https://app.lunchportalen.no';
}

function resolveK6Bin() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(ROOT, 'scripts', 'k6', '.bin', 'k6-v0.57.0-windows-amd64', 'k6.exe'),
    'k6',
    path.join(localAppData, 'Programs', 'k6', 'k6.exe'),
    'C:\\Program Files\\k6\\k6.exe',
  ];
  for (const bin of candidates) {
    const probe = spawnSync(bin, ['version'], { encoding: 'utf8', shell: true });
    if (probe.status === 0) return bin;
  }
  return null;
}

function main() {
  const envLocal = loadEnvFile(path.join(ROOT, '.env.local'));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const k6Bin = resolveK6Bin();
  if (!k6Bin) {
    console.error('k6 not found. Install: winget install GrafanaLabs.k6');
    console.error('  or: choco install k6');
    process.exit(1);
  }

  const extraArgs = process.argv.slice(2);
  const script =
    extraArgs[0] && extraArgs[0].endsWith('.js')
      ? extraArgs.shift()
      : 'scripts/k6/k6-live.js';

  const env = {
    ...process.env,
    K6_BASE_URL: resolveBaseUrl(envLocal),
    K6_SMOKE_EMAIL: process.env.K6_SMOKE_EMAIL || envLocal.PLAYWRIGHT_TEST_EMAIL || 'smoke-test@lunchportalen.no',
    K6_SMOKE_PASSWORD:
      process.env.K6_SMOKE_PASSWORD ||
      envLocal.PLAYWRIGHT_TEST_PASSWORD ||
      envLocal.K6_SMOKE_PASSWORD ||
      '',
    K6_TAG_ENV: process.env.K6_TAG_ENV || 'staging',
    K6_OUTPUT_DIR: process.env.K6_OUTPUT_DIR || 'scripts/k6/results',
    K6_FASES: process.env.K6_FASES || 'smoke',
    VERCEL_AUTOMATION_BYPASS_SECRET:
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
      envLocal.VERCEL_AUTOMATION_BYPASS_SECRET ||
      envLocal.VERCEL_PROTECTION_BYPASS ||
      '',
  };

  if (!env.K6_SMOKE_PASSWORD) {
    console.error('Missing K6_SMOKE_PASSWORD / PLAYWRIGHT_TEST_PASSWORD.');
    console.error('Run: node scripts/smoke/provision-smoke-user.mjs');
    process.exit(1);
  }

  const jsonOut = path.join('scripts', 'k6', 'results', `${stamp}.json`);
  const args = [
    'run',
    `--out=json=${jsonOut}`,
    `--summary-export=${path.join('scripts', 'k6', 'results', `${stamp}-summary-export.json`)}`,
    ...extraArgs,
    script,
  ];

  console.log(`k6 → ${script}`);
  console.log(`base: ${env.K6_BASE_URL} | phases: ${env.K6_FASES} | env: ${env.K6_TAG_ENV}`);
  console.log(`json: ${jsonOut}`);

  const res = spawnSync(k6Bin, args, { stdio: 'inherit', env, shell: true, cwd: ROOT });
  process.exit(res.status ?? 1);
}

main();
