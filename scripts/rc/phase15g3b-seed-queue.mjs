#!/usr/bin/env node
/**
 * Idempotent 15G.3B queue seed/reseed for STAGING only.
 * Uses review-queues.json from phase15g3b export when present, else refuses.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");
const queuePath = join(root, "docs/rc/evidence/phase15g3b/review-queues.json");
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
    console.error("Missing phase15g3b/review-queues.json — run phase15g3b-export-packs.ts first");
    process.exit(1);
  }
  const doc = JSON.parse(readFileSync(queuePath, "utf8"));
  const items = doc.items || [];
  if (items.some((i) => i.status === "APPROVED")) {
    console.error("FATAL: seed contains APPROVED");
    process.exit(2);
  }
  if (process.env.CONFIRM_STAGING_SEED !== "YES") {
    console.log(`DRY-RUN ${items.length} tasks. Set CONFIRM_STAGING_SEED=YES to insert.`);
    process.exit(0);
  }
  const env = loadEnvLocal();
  const url = process.env.DATABASE_URL || env.STAGING_DATABASE_URL || env.DATABASE_URL_STAGING_CERT || "";
  if (!url || url.includes(PROD_REF) || !url.includes(STAGING_REF)) {
    console.error("REFUSE: staging DATABASE_URL required");
    process.exit(3);
  }
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let inserted = 0;
  let skipped = 0;
  for (const item of items) {
    const exists = await c.query(`select 1 from public.compliance_review_queue where subject_id=$1`, [
      item.subjectId,
    ]);
    if (exists.rowCount > 0) {
      skipped += 1;
      continue;
    }
    await c.query(
      `insert into public.compliance_review_queue
        (domain, country_code, locale, subject_id, evidence_checksum, status, subject_author_id, task_version, release_sha, is_fixture)
       values ($1,$2,$3,$4,$5,'QUEUED',$6,$7,$8,$9)`,
      [
        item.domain,
        item.countryCode,
        item.locale,
        item.subjectId,
        item.evidenceChecksum,
        item.subjectAuthorId,
        item.taskVersion || "15g3b.1",
        item.releaseSha,
        !!item.isFixture,
      ],
    );
    inserted += 1;
  }
  const counts = await c.query(
    `select status, count(*)::int n from public.compliance_review_queue group by status order by 1`,
  );
  await c.end();
  console.log(JSON.stringify({ inserted, skipped, byStatus: counts.rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
