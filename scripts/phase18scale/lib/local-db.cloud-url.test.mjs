#!/usr/bin/env node
/**
 * Unit checks for isolated cloud Postgres URL fail-closed rules (no network).
 */
import assert from "node:assert/strict";
import { assertIsolatedCloudPostgresUrl } from "./local-db.mjs";

const REF = "arstaxredytrjcmqcwhh";
process.env.PHASE18_LOAD_REF = REF;
process.env.PHASE18_LOADCERT = "1";

function expectThrow(fn, re) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    assert.match(String(e.message || e), re);
  }
  assert.equal(threw, true, "expected throw");
}

// Direct IPv6 host rejected
expectThrow(
  () =>
    assertIsolatedCloudPostgresUrl(
      `postgresql://postgres:x@db.${REF}.supabase.co:5432/postgres?sslmode=require`,
      "t",
    ),
  /DIRECT_IPV6_FORBIDDEN/,
);

// Production ref rejected
expectThrow(
  () =>
    assertIsolatedCloudPostgresUrl(
      "postgresql://postgres.hkpokyapzarefrgqzkos:x@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require",
      "t",
    ),
  /PRODUCTION_OR_STAGING|FORBIDDEN/,
);

// Localhost rejected
expectThrow(
  () =>
    assertIsolatedCloudPostgresUrl(
      "postgresql://postgres.arstaxredytrjcmqcwhh:x@127.0.0.1:5432/postgres?sslmode=require",
      "t",
    ),
  /LOCALHOST_FORBIDDEN/,
);

// Wrong username rejected
expectThrow(
  () =>
    assertIsolatedCloudPostgresUrl(
      "postgresql://postgres:x@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require",
      "t",
    ),
  /USER_FORBIDDEN/,
);

// Valid pooler accepted with TLS verify
const ok = assertIsolatedCloudPostgresUrl(
  `postgresql://postgres.${REF}:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
  "t",
);
assert.equal(ok.identity.host, "aws-0-eu-west-1.pooler.supabase.com");
assert.equal(ok.identity.username, `postgres.${REF}`);
assert.equal(ok.identity.database, "postgres");
assert.equal(ok.ssl.rejectUnauthorized, true);
assert.match(ok.connectionString, /sslmode=require/);

console.log(JSON.stringify({ local_db_cloud_url_tests: "PASS" }));
