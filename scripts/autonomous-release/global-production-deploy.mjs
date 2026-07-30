#!/usr/bin/env node
/**
 * Exact-SHA production deploy with new markets remaining disabled.
 * Uses Vercel HTTP API (no CLI PATH pitfalls). Never prints secrets.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "docs/rc/launch-2026-08-01");
const PROD_REF = "hkpokyapzarefrgqzkos";
const PREFLIGHT_PATH = path.join(OUT_DIR, "GLOBAL-PRODUCTION-PREFLIGHT.json");
const PROJECT_NAME = "lunchportalen";
const TEAM_SLUG = "lunchportalen";

function sh(cmd, args, opts = {}) {
  const { env: extraEnv, ...rest } = opts;
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...rest,
    // Always preserve PATH — never let caller env wipe the runner environment.
    env: { ...process.env, ...(extraEnv || {}) },
  }).trim();
}

function nowIso() {
  return new Date().toISOString();
}

function buildDatabaseUrl() {
  const direct = String(process.env.DATABASE_URL || "").trim();
  if (direct && direct.includes(PROD_REF)) return direct;
  const ref = String(process.env.SUPABASE_PROD_PROJECT_REF || "").trim();
  const pw = String(process.env.SUPABASE_PROD_DB_PASSWORD || "").trim();
  if (!ref || !pw) return null;
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
}

async function fetchJson(url, { method = "GET", token, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw_len: text.length };
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

async function assertMarketsDisabled(databaseUrl) {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  try {
    const ks = await client.query(
      `select global_cutover_allowed from public.global_activation_kill_switch where id=1`,
    );
    if (ks.rows[0]?.global_cutover_allowed !== false) {
      throw new Error("GLOBAL_CUTOVER_MUST_REMAIN_FALSE");
    }
    const bad = await client.query(
      `select country_code from public.country_production_activation
       where country_code <> 'NO'
         and (production_enabled or registration_enabled or ordering_enabled
              or invoice_only_enabled or platform_commission_enabled)`,
    );
    if (bad.rows.length) {
      throw new Error(`NEW_MARKETS_ENABLED:${bad.rows.map((r) => r.country_code).join(",")}`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

async function waitForHealthSha(baseUrl, expectedSha, attempts = 36) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/health`;
  let last = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    const version = String(body?.data?.version || body?.data?.release?.git_sha || "");
    last = version;
    if (res.ok && body?.ok && version === expectedSha) {
      return { ok: true, version, attempt: i + 1 };
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return { ok: false, version: last };
}

async function resolveTeamAndProject(token) {
  const teams = await fetchJson("https://api.vercel.com/v2/teams", { token });
  if (!teams.ok) throw new Error(`VERCEL_TEAMS_HTTP_${teams.status}`);
  const teamList = Array.isArray(teams.body?.teams) ? teams.body.teams : [];
  const team =
    teamList.find((t) => String(t?.slug || "").toLowerCase() === TEAM_SLUG) ||
    teamList.find((t) => /lunchportalen/i.test(String(t?.slug || t?.name || ""))) ||
    null;
  if (!team?.id) throw new Error("VERCEL_TEAM_NOT_FOUND");

  const qs = new URLSearchParams({ teamId: team.id, limit: "20" });
  const projects = await fetchJson(`https://api.vercel.com/v9/projects?${qs}`, { token });
  if (!projects.ok) throw new Error(`VERCEL_PROJECTS_HTTP_${projects.status}`);
  const projectList = Array.isArray(projects.body?.projects) ? projects.body.projects : [];
  const project =
    projectList.find((p) => String(p?.name || "").toLowerCase() === PROJECT_NAME) || null;
  if (!project?.id) throw new Error("VERCEL_PROJECT_NOT_FOUND");
  return { team, project };
}

async function findDeploymentBySha(token, teamId, projectId, releaseSha) {
  const qs = new URLSearchParams({
    teamId,
    projectId,
    limit: "40",
  });
  const deps = await fetchJson(`https://api.vercel.com/v6/deployments?${qs}`, { token });
  if (!deps.ok) return null;
  const list = Array.isArray(deps.body?.deployments) ? deps.body.deployments : [];
  return (
    list.find((d) => {
      const sha = String(d?.meta?.githubCommitSha || d?.meta?.gitCommitSha || "");
      return sha === releaseSha && (d.state === "READY" || d.readyState === "READY");
    }) ||
    list.find((d) => String(d?.meta?.githubCommitSha || "") === releaseSha) ||
    null
  );
}

async function createGitDeployment(token, teamId, projectId, releaseSha) {
  const qs = new URLSearchParams({ teamId, forceNew: "1" });
  const body = {
    name: PROJECT_NAME,
    project: projectId,
    target: "production",
    gitSource: {
      type: "github",
      org: "Lunchportalen",
      repo: "lunchportalen",
      ref: releaseSha,
      sha: releaseSha,
    },
    meta: {
      githubCommitSha: releaseSha,
      deployReason: "global-production-deploy-markets-disabled",
    },
  };
  const created = await fetchJson(`https://api.vercel.com/v13/deployments?${qs}`, {
    method: "POST",
    token,
    body,
  });
  if (!created.ok) {
    throw new Error(
      `VERCEL_CREATE_HTTP_${created.status}:${JSON.stringify(created.body).slice(0, 240)}`,
    );
  }
  return created.body;
}

async function waitDeploymentReady(token, teamId, deploymentId, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    const qs = new URLSearchParams({ teamId });
    const d = await fetchJson(`https://api.vercel.com/v13/deployments/${deploymentId}?${qs}`, {
      token,
    });
    const state = String(d.body?.readyState || d.body?.status || "");
    if (state === "READY") return { ok: true, body: d.body, attempt: i + 1 };
    if (state === "ERROR" || state === "CANCELED") {
      return { ok: false, body: d.body, attempt: i + 1, state };
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return { ok: false, body: null, state: "TIMEOUT" };
}

async function assignProductionAlias(token, teamId, deploymentId) {
  const qs = new URLSearchParams({ teamId });
  // Promote by assigning production aliases used by the app.
  const aliases = ["app.lunchportalen.no", "lunchportalen.vercel.app"];
  const results = [];
  for (const alias of aliases) {
    const res = await fetchJson(
      `https://api.vercel.com/v2/deployments/${deploymentId}/aliases?${qs}`,
      {
        method: "POST",
        token,
        body: { alias },
      },
    );
    results.push({
      alias,
      ok: res.ok,
      status: res.status,
      error: res.ok ? null : String(res.body?.error?.code || res.body?.error?.message || "").slice(0, 80),
    });
  }
  return results;
}

async function main() {
  const releaseSha = String(process.env.GLOBAL_RELEASE_SHA || "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(releaseSha)) throw new Error("GLOBAL_RELEASE_SHA required");
  const token = String(process.env.VERCEL_TOKEN || "").trim();
  if (!token) throw new Error("VERCEL_TOKEN missing");

  if (fs.existsSync(PREFLIGHT_PATH)) {
    const pf = JSON.parse(fs.readFileSync(PREFLIGHT_PATH, "utf8"));
    if (pf.result !== "PASS") throw new Error("PREFLIGHT_NOT_PASS");
    if (pf.GLOBAL_RELEASE_SHA && String(pf.GLOBAL_RELEASE_SHA).toLowerCase() !== releaseSha) {
      throw new Error("PREFLIGHT_SHA_MISMATCH");
    }
  } else if (process.env.ALLOW_DEPLOY_WITHOUT_LOCAL_PREFLIGHT !== "1") {
    throw new Error("MISSING_PREFLIGHT_EVIDENCE");
  }

  const databaseUrl = buildDatabaseUrl();
  if (!databaseUrl) throw new Error("NO_DATABASE_URL");
  await assertMarketsDisabled(databaseUrl);

  const baseUrl = String(
    process.env.PROD_BASE_URL || process.env.APP_BASE_URL || "https://app.lunchportalen.no",
  ).trim();
  const before = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`).then((r) => r.json());
  const rollbackSha = String(before?.data?.version || "");

  const head = sh("git", ["rev-parse", "HEAD"]).toLowerCase();
  if (head !== releaseSha) throw new Error(`CHECKOUT_NOT_FREEZE:${head}`);

  const { team, project } = await resolveTeamAndProject(token);
  let deployment = await findDeploymentBySha(token, team.id, project.id, releaseSha);
  let created = false;
  if (!deployment) {
    const createdBody = await createGitDeployment(token, team.id, project.id, releaseSha);
    deployment = createdBody;
    created = true;
  }
  const deploymentId = String(deployment.id || deployment.uid || "");
  if (!deploymentId) throw new Error("DEPLOYMENT_ID_MISSING");

  const ready = await waitDeploymentReady(token, team.id, deploymentId);
  if (!ready.ok) {
    throw new Error(`DEPLOYMENT_NOT_READY:${ready.state || "UNKNOWN"}`);
  }

  const aliasResults = await assignProductionAlias(token, team.id, deploymentId);
  const aliasOk = aliasResults.some((a) => a.ok);
  if (!aliasOk) {
    // If already production target from create, alias assign may be redundant.
    console.log(JSON.stringify({ alias_warning: aliasResults }));
  }

  const health = await waitForHealthSha(baseUrl, releaseSha);
  await assertMarketsDisabled(databaseUrl);

  const report = {
    gate: "GLOBAL_PRODUCTION_DEPLOY",
    result: health.ok ? "PASS" : "FAIL",
    GLOBAL_RELEASE_SHA: releaseSha,
    rollback_sha: rollbackSha || null,
    production_sha: health.version || null,
    deployment_id: `${deploymentId.slice(0, 10)}…`,
    deployment_created: created,
    team_slug: team.slug,
    project_name: project.name,
    markets_disabled: true,
    global_cutover_allowed: false,
    alias_results: aliasResults,
    stamped_at: nowIso(),
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "GLOBAL-PRODUCTION-DEPLOY.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(report, null, 2));
  if (!health.ok) process.exit(1);
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e?.message || e).slice(0, 300) }));
  process.exit(2);
});
