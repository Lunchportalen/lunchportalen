#!/usr/bin/env node
/**
 * Seed compliance_review_queue on STAGING only (QUEUED rows).
 * Default: dry-run against docs/rc/evidence/phase15g3a/review-queues.json
 *
 * Requires for insert:
 *   CONFIRM_STAGING_SEED=YES
 *   STAGING_DATABASE_URL (or DATABASE_URL) pointing at staging
 *
 * Never inserts APPROVED. Never fabricates reviewers.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");
const queuePath = join(root, "docs/rc/evidence/phase15g3a/review-queues.json");

const STAGING_REF = "uigxsboqeruxflgzqztl";
const PROD_REF = "hkpokyapzarefrgqzkos";

function loadEnvLocal() {
  const p = join(root, ".env.local");
  if (!existsSync(p)) return {};
  return Object.fromEntries(
    readFileSync(p, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );
}

async function main() {
  if (!existsSync(queuePath)) {
    console.error("Missing review-queues.json — run phase15g3a-export-completeness.ts first");
    process.exit(1);
  }
  const doc = JSON.parse(readFileSync(queuePath, "utf8"));
  const items = doc.items || [];
  console.log(`Queue seeds loaded: ${items.length}`);
  console.log(`Statuses: ${[...new Set(items.map((i) => i.status))].join(",")}`);
  if (items.some((i) => i.status === "APPROVED")) {
    console.error("FATAL: seed file contains APPROVED — refuse");
    process.exit(2);
  }

  if (process.env.CONFIRM_STAGING_SEED !== "YES") {
    console.log("DRY-RUN only. Set CONFIRM_STAGING_SEED=YES to insert into staging.");
    process.exit(0);
  }

  const env = loadEnvLocal();
  const url = process.env.DATABASE_URL || env.STAGING_DATABASE_URL || env.DATABASE_URL_STAGING_CERT || "";
  if (!url) {
    console.error("DATABASE_URL / STAGING_DATABASE_URL required for seed");
    process.exit(1);
  }
  if (url.includes(PROD_REF)) {
    console.error("REFUSE: production database URL detected");
    process.exit(3);
  }
  if (!url.includes(STAGING_REF) && process.env.ALLOW_NON_STAGING_REF !== "YES") {
    console.error(`REFUSE: DATABASE_URL must include staging ref ${STAGING_REF}`);
    process.exit(3);
  }

  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let inserted = 0;
  let skipped = 0;
  for (const item of items) {
    const exists = await c.query(
      `select 1 from public.compliance_review_queue where subject_id = $1 limit 1`,
      [item.subjectId],
    );
    if (exists.rowCount > 0) {
      skipped += 1;
      continue;
    }
    await c.query(
      `insert into public.compliance_review_queue
        (domain, country_code, locale, subject_id, evidence_checksum, status, subject_author_id)
       values ($1,$2,$3,$4,$5,'QUEUED',$6)`,
      [
        item.domain,
        item.countryCode,
        item.locale,
        item.subjectId,
        item.evidenceChecksum,
        item.subjectAuthorId,
      ],
    );
    inserted += 1;
  }
  const counts = await c.query(
    `select status, count(*)::int as n from public.compliance_review_queue group by status order by status`,
  );
  await c.end();
  console.log(JSON.stringify({ inserted, skipped, byStatus: counts.rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
