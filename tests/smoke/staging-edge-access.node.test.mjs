import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  STAGING_HOSTS,
  PRODUCTION_HOSTS,
  appendBypassQuery,
  assertStagingTarget,
  isAllowedStagingHost,
  isProductionHost,
  maskSecret,
  resolveLocation,
  resolveStagingUrl,
  resetCookieJars,
  stagingEdgeHeaders,
} from "../../scripts/test/staging-edge-access.mjs";

describe("staging-edge-access", () => {
  beforeEach(() => {
    resetCookieJars();
  });

  it("accepts explicit staging hosts", () => {
    for (const host of STAGING_HOSTS) {
      assert.equal(isAllowedStagingHost(host), true);
      assert.doesNotThrow(() => assertStagingTarget(`https://${host}`));
    }
    assert.equal(isAllowedStagingHost("lunchportalen-abc123-lunchportalen.vercel.app"), true);
  });

  it("rejects production and unknown hosts", () => {
    for (const host of PRODUCTION_HOSTS) {
      assert.equal(isProductionHost(host), true);
      assert.throws(() => assertStagingTarget(`https://${host}`), /production host blocked/);
    }
    assert.throws(() => assertStagingTarget("https://evil.example.com"), /staging allowlist/);
  });

  it("masks secrets in output", () => {
    assert.equal(maskSecret(""), "(missing)");
    assert.equal(maskSecret("short"), "***");
    assert.match(maskSecret("abcdefghijklmnop"), /abcd\.\.\./);
    assert.doesNotMatch(maskSecret("abcdefghijklmnop"), /klmnop/);
  });

  it("resolves relative URLs against staging base", () => {
    const base = "https://staging.app.lunchportalen.no";
    assert.equal(resolveStagingUrl(base, "/api/health"), `${base}/api/health`);
    assert.throws(() => resolveStagingUrl("", "/api/health"), /baseUrl required/);
  });

  it("follows same-origin relative and absolute redirects", () => {
    const current = "https://staging.app.lunchportalen.no/api/health?x=1";
    assert.equal(resolveLocation(current, "/api/health"), "https://staging.app.lunchportalen.no/api/health");
  });

  it("rejects production redirects", () => {
    const current = "https://staging.app.lunchportalen.no/api/health";
    assert.throws(
      () => resolveLocation(current, "https://app.lunchportalen.no/api/health"),
      /production host blocked/,
    );
  });

  it("appends bypass query with URL encoding", () => {
    const url = appendBypassQuery("https://staging.app.lunchportalen.no/api/health", "a+b=c");
    assert.match(url, /x-vercel-protection-bypass=a%2Bb%3Dc/);
    assert.doesNotMatch(url, /a\+b=c/);
  });

  it("edge bypass headers do not include app auth or cron auth", () => {
    const headers = stagingEdgeHeaders({}, { VERCEL_AUTOMATION_BYPASS_SECRET: "test-bypass-secret-32chars!!" });
    assert.ok(headers["x-vercel-protection-bypass"]);
    assert.equal(headers.authorization, undefined);
    assert.equal(headers["x-cron-secret"], undefined);
  });
});
