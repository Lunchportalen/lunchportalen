#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  PROJECT_REFS,
  assertDbTarget,
  environmentFromProjectRef,
  evaluateBootstrapTarget,
  evaluateDbTarget,
  parseProjectRefFromDatabaseUrl,
} from "./assert-db-target.mjs";

/** Real CI / dashboard connection shapes (password placeholder only). */
const URL_FIXTURES = {
  staging_pooler: `postgresql://postgres.${PROJECT_REFS.staging}:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
  staging_direct: `postgresql://postgres:secret@db.${PROJECT_REFS.staging}.supabase.co:5432/postgres`,
  production_pooler: `postgresql://postgres.${PROJECT_REFS.production}:secret@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  production_direct: `postgresql://postgres:secret@db.${PROJECT_REFS.production}.supabase.co:5432/postgres`,
};

assert.equal(parseProjectRefFromDatabaseUrl(URL_FIXTURES.staging_pooler), PROJECT_REFS.staging);
assert.equal(parseProjectRefFromDatabaseUrl(URL_FIXTURES.staging_direct), PROJECT_REFS.staging);
assert.equal(parseProjectRefFromDatabaseUrl(URL_FIXTURES.production_pooler), PROJECT_REFS.production);
assert.equal(parseProjectRefFromDatabaseUrl(URL_FIXTURES.production_direct), PROJECT_REFS.production);

assert.equal(parseProjectRefFromDatabaseUrl("postgresql://postgres:secret@127.0.0.1:54322/postgres"), null);

assert.equal(environmentFromProjectRef(PROJECT_REFS.staging), "staging");
assert.equal(environmentFromProjectRef(PROJECT_REFS.production), "production");
assert.equal(environmentFromProjectRef("unknown"), null);

assert.deepEqual(
  evaluateDbTarget({ sentinel: "staging", expect: "staging", parsedRef: PROJECT_REFS.staging }),
  {
    decision: "proceed",
    reason: "ok",
    expect: "staging",
    sentinel: "staging",
    parsedRef: PROJECT_REFS.staging,
  },
);

assert.equal(
  evaluateDbTarget({ sentinel: null, expect: "staging", parsedRef: PROJECT_REFS.staging }).decision,
  "abort",
);
assert.equal(
  evaluateDbTarget({ sentinel: null, expect: "staging", parsedRef: PROJECT_REFS.staging }).reason,
  "missing_sentinel",
);

assert.equal(
  evaluateDbTarget({ sentinel: "production", expect: "staging", parsedRef: PROJECT_REFS.production }).decision,
  "abort",
);

assert.equal(
  evaluateDbTarget({ sentinel: "staging", expect: "staging", parsedRef: PROJECT_REFS.production }).decision,
  "abort",
);
assert.equal(
  evaluateDbTarget({ sentinel: "staging", expect: "staging", parsedRef: PROJECT_REFS.production }).reason,
  "ref_contradicts_expect",
);

assert.equal(
  evaluateDbTarget({ sentinel: "staging", expect: "staging", parsedRef: null }).decision,
  "proceed",
);

assert.equal(
  evaluateBootstrapTarget({ expect: "staging", parsedRef: PROJECT_REFS.staging }).decision,
  "proceed",
);
assert.equal(
  evaluateBootstrapTarget({ expect: "production", parsedRef: PROJECT_REFS.production }).decision,
  "proceed",
);
assert.equal(
  evaluateBootstrapTarget({ expect: "staging", parsedRef: null }).reason,
  "ref_unparseable",
);
assert.equal(
  evaluateBootstrapTarget({ expect: "staging", parsedRef: PROJECT_REFS.production }).reason,
  "ref_mismatch",
);

for (const [label, url] of Object.entries(URL_FIXTURES)) {
  const env = label.startsWith("staging") ? "staging" : "production";
  const boot = evaluateBootstrapTarget({ expect: env, parsedRef: parseProjectRefFromDatabaseUrl(url) });
  assert.equal(boot.decision, "proceed", `bootstrap must proceed for ${label}`);
  const wrongEnv = env === "staging" ? "production" : "staging";
  const wrong = evaluateBootstrapTarget({ expect: wrongEnv, parsedRef: parseProjectRefFromDatabaseUrl(url) });
  assert.equal(wrong.decision, "abort", `bootstrap must abort wrong label for ${label}`);
  assert.equal(wrong.reason, "ref_mismatch");
}

const stagingUrl = process.env.STAGING_DATABASE_URL || process.env.SUPABASE_POSTGRES_URL || "";
const prodUrl = process.env.DATABASE_URL || "";

async function runLiveEvidence() {
  if (stagingUrl.includes("uigx")) {
    const parsed = parseProjectRefFromDatabaseUrl(stagingUrl);
    assert.equal(parsed, PROJECT_REFS.staging, "live staging URL must parse to uigx ref");

    const boot = await assertDbTarget({ connectionString: stagingUrl, expect: "staging", bootstrap: true });
    assert.equal(boot.decision, "proceed", `live staging bootstrap: ${JSON.stringify(boot)}`);

    const ok = await assertDbTarget({ connectionString: stagingUrl, expect: "staging" });
    assert.equal(ok.decision, "proceed", `live staging full guard: ${JSON.stringify(ok)}`);
    assert.equal(ok.sentinel, "staging");
    console.log("evidence: uigx ref==uigx + full guard proceed OK");
  }

  if (prodUrl.includes("hkpoky")) {
    const parsed = parseProjectRefFromDatabaseUrl(prodUrl);
    assert.equal(parsed, PROJECT_REFS.production, "live prod URL must parse to hkpoky ref");

    const bootProd = await assertDbTarget({ connectionString: prodUrl, expect: "production", bootstrap: true });
    assert.equal(bootProd.decision, "proceed");

    const wrong = await assertDbTarget({ connectionString: prodUrl, expect: "staging" });
    assert.equal(wrong.decision, "abort", "prod URL + expect=staging must abort");
    console.log(`evidence: prod wrong-target abort OK (${wrong.reason})`);
  }
}

if (process.env.ASSERT_DB_TARGET_LIVE === "1") {
  await runLiveEvidence();
}

console.log(JSON.stringify({ ok: true, module: "assert-db-target", url_fixtures: Object.keys(URL_FIXTURES) }, null, 2));
