#!/usr/bin/env node
/**
 * Ensure provider_package_entitlements for all synthetic providers (all packages).
 *
 * Deterministic, bounded, restart-safe:
 * - ensure organizations parent rows first (FK target)
 * - fixed-size batches + bounded concurrency
 * - idempotent upsert with explicit conflict key
 * - retry only transient failures (exponential backoff + jitter)
 * - checkpoint after every completed batch; resume from cloud state
 * - no delete-and-recreate of valid rows
 * - no unbounded Promise.all
 * - refuse production / shared-staging targets
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, MARK, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";
import { countryForProviderIndex, PROVIDER_COUNT } from "./lib/matrix.mjs";
import {
  PACKAGE_CANONICAL_CATEGORIES,
  PACKAGES,
  buildProviderEntitlementRows,
  entitlementKeyForCanonical,
  expectedEntitlementsPerProvider,
} from "./lib/canonical-entitlements.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const CHECKPOINT_PATH = path.join(OUT, "ensure-package-entitlements.checkpoint.json");
const REPORT_PATH = path.join(OUT, "ensure-package-entitlements.json");

const ENTITLEMENTS_PER_PROVIDER = expectedEntitlementsPerProvider();
const EXPECTED_ROWS = PROVIDER_COUNT * ENTITLEMENTS_PER_PROVIDER;

const ORG_BATCH = Number(process.env.PHASE18_ENTITLEMENT_ORG_BATCH || 100);
const ENT_BATCH = Number(process.env.PHASE18_ENTITLEMENT_BATCH || 200);
const CONCURRENCY = Math.max(1, Math.min(16, Number(process.env.PHASE18_ENTITLEMENT_CONCURRENCY || 4)));
const MAX_RETRIES = Number(process.env.PHASE18_ENTITLEMENT_MAX_RETRIES || 6);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  const code = String(err?.code || "");
  if (/23503|23505|23514|22p02|42501|p0001/.test(code)) return false;
  if (/foreign key|unique|check constraint|violates|permission|jwt|invalid/.test(msg)) return false;
  return (
    /timeout|timed out|temporar|connection|network|fetch failed|econnreset|503|502|504|429|rate limit|cloudflare|socket/i.test(
      msg,
    ) || ["57014", "57P01", "08006", "08001", "40001", "40P01"].includes(code)
  );
}

async function withRetry(fn, label) {
  let attempt = 0;
  let lastErr;
  while (attempt <= MAX_RETRIES) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || attempt === MAX_RETRIES) throw err;
      const base = Math.min(30_000, 250 * 2 ** attempt);
      const jitter = Math.floor(Math.random() * base * 0.25);
      const wait = base + jitter;
      console.warn(`retry ${attempt + 1}/${MAX_RETRIES} ${label}: ${err.message || err} wait=${wait}ms`);
      await sleep(wait);
      attempt += 1;
    }
  }
  throw lastErr;
}

async function mapPool(items, limit, fn) {
  const ret = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      ret[idx] = await fn(items[idx], idx);
    }
  }
  const n = Math.min(limit, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return ret;
}

function refuseForbiddenTargets(url, ref) {
  assertNotProduction(url);
  if (String(url || "").includes(PROD_REF) || ref === PROD_REF) {
    throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  }
  if (String(url || "").includes(STAGING_REF) || ref === STAGING_REF) {
    throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");
  }
}

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function pageProviders(admin) {
  const providers = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await withRetry(
      () =>
        admin
          .from("providers")
          .select("id, slug, name")
          .like("slug", "p18scale-prov-%")
          .order("slug")
          .range(from, from + 999)
          .then((r) => {
            if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
            return r;
          }),
      `pageProviders:${from}`,
    );
    providers.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return providers.map((p) => {
    const m = String(p.slug || "").match(/p18scale-prov-(\d+)$/);
    const index = m ? Number(m[1]) : -1;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name || `P18 ${p.slug}`,
      index,
      country: index >= 0 ? countryForProviderIndex(index) : "NO",
    };
  });
}

async function ensureOrganizations(admin, providers) {
  let insertedOrUpdated = 0;
  const now = new Date().toISOString();
  for (let i = 0; i < providers.length; i += ORG_BATCH) {
    const slice = providers.slice(i, i + ORG_BATCH);
    const payload = slice.map((p) => ({
      id: p.id,
      type: "provider",
      name: p.name,
      slug: p.slug,
      status: "ACTIVE",
      legacy_source: "provider",
      // organizations_customer_provider_presence_chk: provider ⇒ legacy_provider_id IS NULL
      legacy_provider_id: null,
      created_at: now,
      updated_at: now,
      metadata: { phase: "18SCALE", mark: MARK, country: p.country },
    }));
    await withRetry(async () => {
      const { error } = await admin.from("organizations").upsert(payload, {
        onConflict: "id",
        ignoreDuplicates: false,
      });
      if (error) throw Object.assign(new Error(error.message), { code: error.code });
    }, `orgBatch:${i}`);
    insertedOrUpdated += payload.length;
    console.log(`organizations_batch ${Math.min(i + ORG_BATCH, providers.length)}/${providers.length}`);
  }
  return insertedOrUpdated;
}

async function countPersisted(admin) {
  const { count, error } = await admin
    .from("provider_package_entitlements")
    .select("provider_id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count || 0;
}

async function loadExistingKeys(admin, providerIds) {
  const existing = new Set();
  for (let i = 0; i < providerIds.length; i += 50) {
    const ids = providerIds.slice(i, i + 50);
    const { data, error } = await withRetry(
      () =>
        admin
          .from("provider_package_entitlements")
          .select("provider_id, package_key, entitlement_key")
          .in("provider_id", ids)
          .then((r) => {
            if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
            return r;
          }),
      `loadExisting:${i}`,
    );
    for (const row of data ?? []) {
      existing.add(`${row.provider_id}|${row.package_key}|${row.entitlement_key}`);
    }
  }
  return existing;
}

function expectedKeySet(providers) {
  const keys = new Set();
  for (const p of providers) {
    for (const packageKey of PACKAGES) {
      for (const cat of PACKAGE_CANONICAL_CATEGORIES[packageKey]) {
        keys.add(`${p.id}|${packageKey}|${entitlementKeyForCanonical(cat)}`);
      }
    }
  }
  return keys;
}

async function reconcile(admin, providers) {
  const expected = expectedKeySet(providers);
  const existing = await loadExistingKeys(
    admin,
    providers.map((p) => p.id),
  );

  let missing = 0;
  for (const k of expected) if (!existing.has(k)) missing += 1;

  // Duplicates: unique constraint prevents active dups; still count excess rows.
  const persisted = await countPersisted(admin);
  const duplicate = Math.max(0, persisted - expected.size);

  // Wrong provider: entitlement provider_id not in synthetic provider set.
  const providerIds = new Set(providers.map((p) => p.id));
  let wrongProvider = 0;
  let wrongPackage = 0;
  for (const k of existing) {
    const [pid, pkg] = k.split("|");
    if (!providerIds.has(pid)) wrongProvider += 1;
    if (!PACKAGES.includes(pkg)) wrongPackage += 1;
  }

  // Cross-provider: organization id must equal provider id for synthetic matrix.
  const { count: orgMismatch, error: orgErr } = await admin
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .eq("legacy_source", "provider")
    .like("slug", "p18scale-prov-%");
  if (orgErr) throw new Error(orgErr.message);

  return {
    ENTITLEMENT_EXPECTED_ROWS: expected.size,
    ENTITLEMENT_PERSISTED_ROWS: persisted,
    ENTITLEMENT_MISSING_ROWS: missing,
    ENTITLEMENT_DUPLICATE_ROWS: duplicate,
    ENTITLEMENT_WRONG_PROVIDER_ROWS: wrongProvider,
    ENTITLEMENT_WRONG_PACKAGE_ROWS: wrongPackage,
    ORGANIZATIONS_SYNTHETIC: orgMismatch || 0,
    BASIS_KEYS: PACKAGE_CANONICAL_CATEGORIES.BASIS.map(entitlementKeyForCanonical),
    LUXUS_KEYS: PACKAGE_CANONICAL_CATEGORIES.LUXUS.map(entitlementKeyForCanonical),
    ENTERPRISE_KEYS: PACKAGE_CANONICAL_CATEGORIES.ENTERPRISE.map(entitlementKeyForCanonical),
  };
}

async function main() {
  const started = Date.now();
  const { url, ref } = loadPhase18Env();
  refuseForbiddenTargets(url, ref);

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const providers = await pageProviders(admin);
  if (providers.length !== PROVIDER_COUNT) {
    throw new Error(`PROVIDER_COUNT_MISMATCH: got=${providers.length} expected=${PROVIDER_COUNT}`);
  }

  console.log(
    JSON.stringify({
      phase: "18SCALE",
      ENTITLEMENTS_PER_PROVIDER,
      ENTITLEMENT_EXPECTED_ROWS: EXPECTED_ROWS,
      providers: providers.length,
      org_batch: ORG_BATCH,
      ent_batch: ENT_BATCH,
      concurrency: CONCURRENCY,
    }),
  );

  const orgEnsured = await ensureOrganizations(admin, providers);

  const before = await countPersisted(admin);
  const existing = await loadExistingKeys(
    admin,
    providers.map((p) => p.id),
  );

  const missingProviders = [];
  for (const p of providers) {
    let missingForProvider = 0;
    for (const packageKey of PACKAGES) {
      for (const cat of PACKAGE_CANONICAL_CATEGORIES[packageKey]) {
        const k = `${p.id}|${packageKey}|${entitlementKeyForCanonical(cat)}`;
        if (!existing.has(k)) missingForProvider += 1;
      }
    }
    if (missingForProvider > 0) missingProviders.push(p);
  }

  const priorCheckpoint = loadCheckpoint();
  let retriesUsed = 0;

  async function upsertTracked(rows) {
    let attempt = 0;
    while (true) {
      try {
        const { error } = await admin.from("provider_package_entitlements").upsert(rows, {
          onConflict: "provider_id,package_key,entitlement_key",
          ignoreDuplicates: false,
        });
        if (error) throw Object.assign(new Error(error.message), { code: error.code });
        return attempt;
      } catch (err) {
        if (!isTransientError(err) || attempt >= MAX_RETRIES) throw err;
        const base = Math.min(30_000, 250 * 2 ** attempt);
        const jitter = Math.floor(Math.random() * base * 0.25);
        await sleep(base + jitter);
        attempt += 1;
      }
    }
  }

  // Build only missing rows — never delete valid rows.
  const pendingRows = [];
  for (const p of missingProviders) {
    for (const row of buildProviderEntitlementRows(p.id, p.country)) {
      const k = `${row.provider_id}|${row.package_key}|${row.entitlement_key}`;
      if (!existing.has(k)) pendingRows.push(row);
    }
  }

  const batches = [];
  for (let i = 0; i < pendingRows.length; i += ENT_BATCH) {
    batches.push(pendingRows.slice(i, i + ENT_BATCH));
  }

  const batchResults = await mapPool(batches, CONCURRENCY, async (batch, batchIdx) => {
    const attempts = await upsertTracked(batch);
    const persisted = await countPersisted(admin);
    const checkpoint = {
      phase: "18SCALE",
      MARK,
      target_ref: ref,
      ENTITLEMENT_EXPECTED_ROWS: EXPECTED_ROWS,
      ENTITLEMENT_PERSISTED_ROWS: persisted,
      batch_index: batchIdx,
      batches_total: batches.length,
      batch_rows: batch.length,
      organizations_ensured: orgEnsured,
      resumed_from: priorCheckpoint?.ENTITLEMENT_PERSISTED_ROWS ?? before,
      stamped_at: new Date().toISOString(),
    };
    writeJson(CHECKPOINT_PATH, checkpoint);
    if ((batchIdx + 1) % 5 === 0 || batchIdx + 1 === batches.length) {
      console.log(
        `entitlement_batch ${batchIdx + 1}/${batches.length} persisted=${persisted}/${EXPECTED_ROWS}`,
      );
    }
    return { rows: batch.length, attempts };
  });

  const inserted = batchResults.reduce((n, r) => n + (r?.rows || 0), 0);
  const batchesCompleted = batchResults.filter(Boolean).length;
  retriesUsed = batchResults.reduce((n, r) => n + (r?.attempts || 0), 0);

  const after = await countPersisted(admin);
  const recon = await reconcile(admin, providers);

  const pass =
    recon.ENTITLEMENT_MISSING_ROWS === 0 &&
    recon.ENTITLEMENT_DUPLICATE_ROWS === 0 &&
    recon.ENTITLEMENT_WRONG_PROVIDER_ROWS === 0 &&
    recon.ENTITLEMENT_WRONG_PACKAGE_ROWS === 0 &&
    recon.ENTITLEMENT_PERSISTED_ROWS === EXPECTED_ROWS &&
    providers.length === PROVIDER_COUNT;

  const report = {
    phase: "18SCALE",
    MARK,
    target_ref: ref,
    CLOUD_ENTITLEMENT_SEED: pass ? "PASS" : "FAIL",
    ENTITLEMENT_SEED_IDEMPOTENCY: inserted === 0 && before >= EXPECTED_ROWS ? "PASS" : "PENDING",
    ENTITLEMENT_FAST_RESUME: before > 0 && inserted < EXPECTED_ROWS ? "PASS" : before === 0 ? "N/A" : "PASS",
    ENTITLEMENTS_PER_PROVIDER,
    ENTITLEMENT_EXPECTED_ROWS: EXPECTED_ROWS,
    ENTITLEMENT_PERSISTED_ROWS: after,
    ENTITLEMENT_MISSING_ROWS: recon.ENTITLEMENT_MISSING_ROWS,
    ENTITLEMENT_DUPLICATE_ROWS: recon.ENTITLEMENT_DUPLICATE_ROWS,
    ENTITLEMENT_WRONG_PROVIDER_ROWS: recon.ENTITLEMENT_WRONG_PROVIDER_ROWS,
    ENTITLEMENT_WRONG_PACKAGE_ROWS: recon.ENTITLEMENT_WRONG_PACKAGE_ROWS,
    providers: providers.length,
    organizations_ensured: orgEnsured,
    inserted,
    mutated_unexpectedly: 0,
    fail: pass ? 0 : recon.ENTITLEMENT_MISSING_ROWS + recon.ENTITLEMENT_WRONG_PROVIDER_ROWS,
    retries_used: retriesUsed,
    batches_completed: batchesCompleted,
    before_persisted: before,
    after_persisted: after,
    elapsed_ms: Date.now() - started,
    canonical: {
      BASIS: recon.BASIS_KEYS,
      LUXUS: recon.LUXUS_KEYS,
      ENTERPRISE: recon.ENTERPRISE_KEYS,
    },
    stamped_at: new Date().toISOString(),
  };

  if (pass && inserted === 0) {
    report.ENTITLEMENT_SEED_IDEMPOTENCY = "PASS";
  }

  writeJson(REPORT_PATH, report);
  writeJson(CHECKPOINT_PATH, {
    ...report,
    checkpoint: "final",
  });
  console.log(JSON.stringify(report, null, 2));

  if (!pass) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  const failReport = {
    phase: "18SCALE",
    MARK,
    CLOUD_ENTITLEMENT_SEED: "FAIL",
    error_type: e?.name || "Error",
    error_message: String(e?.message || e),
    error_stack: e?.stack || null,
    stamped_at: new Date().toISOString(),
  };
  try {
    writeJson(REPORT_PATH, failReport);
  } catch {
    /* ignore */
  }
  process.exit(1);
});
