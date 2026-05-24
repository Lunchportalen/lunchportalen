/**
 * DC-011 route auth inventory — Fase 1 + Fase 2/2.5 batch heuristics.
 * READ-ONLY analysis of app/api route.ts files.
 */
import fs from "fs";
import path from "path";

const root = "app/api";
const files = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name === "route.ts") files.push(p.replace(/\\/g, "/"));
  }
}
walk(root);

const unique = [...new Set(files)].sort();

function toUrl(file) {
  return file.replace(/^app/, "").replace(/\/route\.ts$/, "");
}

function methods(src) {
  const m = new Set();
  for (const x of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
    if (new RegExp(`export\\s+(async\\s+)?function\\s+${x}\\b`).test(src)) m.add(x);
    if (new RegExp(`export\\s+const\\s+${x}\\s*=`).test(src)) m.add(x);
  }
  return [...m].sort().join(", ") || "(none)";
}

function hasHttpHandler(src) {
  return methods(src) !== "(none)";
}

function lineOf(src, re) {
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i + 1;
  }
  return null;
}

function firstMatchLine(src, patterns) {
  for (const re of patterns) {
    const ln = lineOf(src, re);
    if (ln) return { re: re.source, ln };
  }
  return null;
}

function nonCommentLines(src) {
  return src.split("\n").filter((l) => l.trim() && !l.trim().startsWith("//"));
}

function isDeadCodeStripped(src) {
  return src.replace(/if\s*\(\s*false\s*\)\s*\{[\s\S]*?\n\}/g, "");
}

function isStubRoute(src) {
  if (/supabaseAdmin|\.from\s*\(|scopeOr401|requireRole|auth\.getUser|getAuthContext/.test(src)) return false;
  const only410or501 =
    /return jsonErr\([^)]*,\s*410/.test(src) ||
    /return jsonErr\([^)]*,\s*501/.test(src) ||
    /"DEPRECATED"|"NOT_IMPLEMENTED"|"ROUTE_DEPRECATED"/.test(src);
  return only410or501 && methods(src) !== "(none)";
}

function resolveRedirectApiTarget(file, src) {
  const m = src.match(/(?:target\.)?pathname\s*=\s*["'](\/api\/[^"']+)["']/);
  if (!m) return null;
  const urlPath = m[1];
  const rel = "app" + urlPath + "/route.ts";
  if (fs.existsSync(rel)) return rel.replace(/\\/g, "/");
  return null;
}

function isReExportShim(src) {
  const stripped = isDeadCodeStripped(src);
  const lines = stripped
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith("//") && !t.startsWith("/*") && !t.startsWith("*");
    });
  if (lines.length >= 8) return false;
  return /export\s+\{[^}]+\}\s+from\s+["']/.test(stripped);
}

function resolveReExportTarget(file, src) {
  const stripped = isDeadCodeStripped(src);
  const m = stripped.match(/export\s+\{[^}]+\}\s+from\s+["']([^"']+)["']/);
  if (!m) return null;
  const rel = m[1];
  if (!rel.startsWith(".")) return null;
  const base = path.join(path.dirname(file), rel).replace(/\\/g, "/");
  for (const ext of [".ts", "/route.ts"]) {
    const candidate = base.endsWith(".ts") ? base : base + ext;
    if (fs.existsSync(candidate)) return candidate;
    if (fs.existsSync(base + ".ts")) return base + ".ts";
  }
  if (fs.existsSync(base + "/route.ts")) return base + "/route.ts";
  return null;
}

/** B4b — handler delegates to sibling route.ts (thin proxy) */
function resolveHandlerDelegateTarget(file, src) {
  const m = src.match(
    /import\s+\{\s*(?:GET|POST|PUT|PATCH|DELETE)(?:\s+as\s+\w+)?(?:\s*,\s*(?:GET|POST|PUT|PATCH|DELETE)(?:\s+as\s+\w+)?)*\s*\}\s+from\s+["'](\.\/[^"']+|\.\.\/[^"']+)["']/,
  );
  if (!m) return null;
  const rel = m[1];
  if (!rel.startsWith(".")) return null;
  let base = path.join(path.dirname(file), rel).replace(/\\/g, "/");
  if (!base.endsWith(".ts")) base += ".ts";
  if (base.endsWith("/route.ts.ts")) base = base.replace(/\.ts\.ts$/, ".ts");
  if (fs.existsSync(base)) return base;
  if (fs.existsSync(base.replace(/\.ts$/, "/route.ts"))) return base.replace(/\.ts$/, "/route.ts");
  return null;
}

function classifyViaTarget(file, src, url, depth, visited, batchLabel) {
  const target =
    resolveReExportTarget(file, src) ??
    resolveHandlerDelegateTarget(file, src) ??
    resolveRedirectApiTarget(file, src);
  if (!target || visited.has(target)) return null;
  visited.add(target);
  const targetSrc = fs.readFileSync(target, "utf8");
  const targetUrl = toUrl(target.endsWith("/route.ts") ? target : target.replace(/\.ts$/, "/route.ts"));
  const p1 = classifyPhase1(target, targetSrc, targetUrl);
  if (p1.cat !== "UKLART") {
    return { cat: p1.cat, evidence: `${batchLabel} → ${target} (${p1.evidence})`, batch: batchLabel };
  }
  const batch = applyBatchRules(target, targetSrc, targetUrl, depth + 1, visited);
  if (batch && batch.cat !== "UKLART" && !batch.cat.startsWith("UKLART")) {
    return { ...batch, evidence: `${batchLabel} → ${target}; ${batch.evidence}`, batch: batchLabel };
  }
  return null;
}

/** ─── Phase 1 classification (unchanged semantics, no B4 re-export) ─── */
function classifyPhase1(file, src, url) {
  const evidence = [];
  let cat = null;

  if (/requireCronAuth\s*\(/.test(src)) {
    cat = "cron-secret";
    const m = firstMatchLine(src, [/requireCronAuth/]);
    evidence.push(`requireCronAuth (${file}:${m?.ln ?? "?"})`);
  } else if (url.includes("/cron/") && /CRON_SECRET|SYSTEM_MOTOR_SECRET|x-cron-secret|x-vercel-cron/.test(src)) {
    cat = "cron-secret";
    const m = firstMatchLine(src, [/CRON_SECRET/, /SYSTEM_MOTOR_SECRET/, /x-cron-secret/, /x-vercel-cron/]);
    const weak = isCronFailOpen(src);
    evidence.push(`cron env/header (${file}:${m?.ln ?? "?"})${weak ? " [fail-open if secret unset]" : ""}`);
  } else if (/verifySanityWebhookSignature/.test(src)) {
    cat = "webhook-sig";
    const m = firstMatchLine(src, [/verifySanityWebhookSignature/]);
    evidence.push(`verifySanityWebhookSignature (${file}:${m?.ln ?? "?"})`);
  } else if (/verifyTripletexWebhookSignature|verifyTripletexSignature/.test(src)) {
    cat = "webhook-sig";
    const m = firstMatchLine(src, [/verifyTripletexWebhookSignature/, /verifyTripletexSignature/]);
    evidence.push(`verifyTripletexWebhookSignature (${file}:${m?.ln ?? "?"})`);
  } else if (url.startsWith("/api/webhooks/")) {
    cat = "UKLART";
    evidence.push(`webhooks path without known verify (${file})`);
  } else if (/requireRoleOr403/.test(src) && /scopeOr401/.test(src)) {
    cat = "role-check";
    const m = firstMatchLine(src, [/requireRoleOr403/]);
    evidence.push(`scopeOr401 + requireRoleOr403 (${file}:${m?.ln ?? "?"})`);
  } else if (/requireSuperadmin\s*\(|isSuperadminProfile\s*\(|requireSuperadminProfile/.test(src)) {
    cat = "role-check";
    const m = firstMatchLine(src, [/requireSuperadmin/, /isSuperadminProfile/, /requireSuperadminProfile/]);
    evidence.push(`inline superadmin gate (${file}:${m?.ln ?? "?"})`);
  } else if (/resolveAiTenantExecutionIds/.test(src)) {
    cat = "session";
    evidence.push(`resolveAiTenantExecutionIds → getAuthContext (${file}:${lineOf(src, /resolveAiTenantExecutionIds/)})`);
  } else if (/scopeOr401|getAuthContext\s*\(|requireAuth\s*\(/.test(src)) {
    cat = "session";
    const m = firstMatchLine(src, [/scopeOr401/, /getAuthContext/, /requireAuth/]);
    evidence.push(`${m?.re ?? "auth"} (${file}:${m?.ln ?? "?"})`);
  } else if (/\.auth\.getUser\s*\(|auth\.getUser\s*\(/.test(src)) {
    cat = "session";
    const m = firstMatchLine(src, [/\.auth\.getUser/, /auth\.getUser/]);
    evidence.push(`supabaseServer().auth.getUser (${file}:${m?.ln ?? "?"})`);
  } else if (/supabaseAdmin\s*\(\)|adminClient\s*\(\)/.test(src)) {
    if (url.startsWith("/api/internal/")) {
      if (/requireCronAuth/.test(src)) {
        cat = "cron-secret";
        evidence.push(`internal + requireCronAuth (${file})`);
      } else {
        cat = "UKLART";
        evidence.push(`internal + supabaseAdmin without cron auth (${file}:${lineOf(src, /supabaseAdmin/)})`);
      }
    } else if (url.includes("/cron/")) {
      cat = "UKLART";
      evidence.push(`cron path missing requireCronAuth (${file})`);
    } else {
      cat = "UKLART";
      evidence.push(`supabaseAdmin without route guard (${file}:${lineOf(src, /supabaseAdmin/)})`);
    }
  }

  if (!cat) {
    const anonRules = [
      [/^\/api\/health(\/|$)/, "k8s/readiness probe"],
      [/^\/api\/auth\/(login|logout|post-login|forgot-password|accept-invite|redirect|session|dev-bypass|register-company-admin|profile)/, "auth bootstrap"],
      [/^\/api\/auth\/debug-cookies/, "dev debug LP_DEBUG_AUTH"],
      [/^\/api\/public\//, "public prefix"],
      [/^\/api\/onboarding\//, "onboarding validation"],
      [/^\/api\/accept-invite\//, "invite completion"],
      [/^\/api\/admin\/accept-invite\//, "admin invite completion"],
      [/^\/api\/admin\/auth\/login/, "admin auth login"],
      [/^\/api\/contact$/, "CONTACT_FORM_RL"],
      [/^\/api\/track\//, "LP_TRACK_CLICK_ALLOW_HOSTS"],
      [/^\/api\/content\/global\//, "public CMS read"],
      [/^\/api\/address\/search/, "address lookup"],
      [/^\/api\/address\/resolve/, "Kartverket read-only resolve"],
      [/^\/api\/company\/create/, "registration"],
      [/^\/api\/customers\/register/, "lead capture"],
      [/^\/api\/saas\/billing\/webhook/, "billing webhook"],
      [/^\/api\/experiments\/track/, "experiment pixel"],
      [/^\/api\/social\/track/, "social analytics"],
      [/^\/api\/social\/redirect/, "redirect tracker"],
      [/^\/api\/pitch(\/|$)/, "public pitch"],
      [/^\/api\/status(\/|$)/, "status"],
      [/^\/api\/register/, "registration"],
      [/^\/api\/system\/time/, "read-only klokke/cutoff"],
    ];
    for (const [re, note] of anonRules) {
      if (re.test(url)) {
        cat = "anon-allowed";
        evidence.push(note);
        break;
      }
    }
  }

  if (!cat && /stripe.*webhook|STRIPE_WEBHOOK|constructEvent/.test(src)) {
    cat = "webhook-sig";
    evidence.push(`stripe webhook (${file})`);
  }

  if (!cat && /^\/api\/(worker|system\/outbox|outbox)\//.test(url) && /CRON_SECRET|requireCronAuth|SYSTEM_MOTOR_SECRET/.test(src)) {
    cat = "cron-secret";
    evidence.push(`internal worker secret (${file})`);
  }

  if (!cat && isStubRoute(src)) {
    cat = "anon-allowed";
    evidence.push("stub route (410/501, ingen DB/auth)");
  }

  if (!cat) {
    cat = "UKLART";
    evidence.push(`no recognized auth pattern (${file})`);
  }

  return { cat, evidence: evidence.join("; ") };
}

/** ─── B1–B7 batch helpers ─── */

function matchB1(src, file) {
  const patterns = [
    [/\.auth\.getUser\s*\(/, ".auth.getUser"],
    [/supabase\.auth\.getUser\s*\(/, "supabase.auth.getUser"],
    [/requireUser\s*\(/, "requireUser"],
    [/getSessionOrRedirect\s*\(/, "getSessionOrRedirect"],
    [/getScope\s*\(/, "getScope"],
    [/from\s+["']@\/lib\/server\/auth\/session["']/, "import lib/server/auth/session"],
    [/from\s+["']@\/lib\/auth\/getSession["']/, "import lib/auth/getSession"],
  ];
  for (const [re, label] of patterns) {
    const ln = lineOf(src, re);
    if (ln) return { cat: "session", evidence: `B1 ${label} (${file}:${ln})` };
  }
  return null;
}

function matchB2(src, file) {
  const patterns = [
    [/requireSuperadmin\s*\(/, "requireSuperadmin"],
    [/isSuperadminProfile\s*\(/, "isSuperadminProfile"],
    [/requireSuperadminProfile/, "requireSuperadminProfile"],
    [/requireRoleOr403\s*\(/, "requireRoleOr403"],
    [/requireRole\s*\(/, "requireRole"],
    [/superadminControlTowerJsonGet\s*\(/, "superadminControlTowerJsonGet"],
    [/assertRole\s*\(/, "assertRole"],
  ];
  for (const [re, label] of patterns) {
    const ln = lineOf(src, re);
    if (ln) return { cat: "role-check", evidence: `B2 ${label} (${file}:${ln})` };
  }
  return null;
}

function hasRequestLevelAuth(src) {
  if (matchB1(src, "x") || matchB2(src, "x")) return true;
  return /requireCronAuth\s*\(|scopeOr401|getAuthContext\s*\(|requireAuth\s*\(|getScope\s*\(|verifySanityWebhook|verifyTripletexWebhook|verifyStripeSignature|constructEvent|timingSafeEqual|getTenantContext\s*\(|requireApiKey\s*\(/.test(
    src,
  );
}

const B3A_ANON_PREFIXES = [
  /^\/api\/health(\/|$)/,
  /^\/api\/onboarding\//,
  /^\/api\/auth\/forgot-password$/,
  /^\/api\/auth\/accept-invite$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/auth\/post-login$/,
  /^\/api\/auth\/redirect$/,
  /^\/api\/auth\/session$/,
  /^\/api\/auth\/register-company-admin$/,
  /^\/api\/accept-invite\//,
  /^\/api\/admin\/accept-invite\//,
  /^\/api\/admin\/invites\//,
  /^\/api\/social\/track$/,
  /^\/api\/social\/redirect$/,
  /^\/api\/experiments\/track$/,
  /^\/api\/public\//,
];

const B3A_RPC = /lp_company_register|lp_company_invite_accept|lp_accept_invite/;

function firstAdminCallIndex(src) {
  const m = src.match(/supabaseAdmin\s*\(|adminClient\s*\(/);
  return m ? m.index ?? -1 : -1;
}

function hasProtectionBeforeAdmin(src) {
  const idx = firstAdminCallIndex(src);
  if (idx < 0) return null;
  const before = src.slice(0, idx);
  if (/z\.object|\.safeParse\s*\(|\.parse\s*\(/.test(before)) return "zod før admin";
  if (/ratelimit|rateLimiter|withRateLimit|rateLimit|checkAiRateLimit|CONTACT_FORM_RL/i.test(before)) return "rate-limit før admin";
  if (/turnstile|recaptcha|hcaptcha/i.test(before)) return "captcha før admin";
  if (/\/\/\s*@anon-allowed:/.test(before)) return "@anon-allowed kommentar";
  if (B3A_RPC.test(before)) return "lp_* RPC med innebygd validering";
  if (/isUuid\s*\(|isEmail\s*\(|isValidNoPhone|normalizeNoPhone/.test(before)) return "input-validering før admin";
  return null;
}

function b3aPathPrefix(url) {
  for (const re of B3A_ANON_PREFIXES) {
    if (re.test(url)) return url.match(/^\/api\/[^/]+/)?.[0] ?? url;
  }
  return null;
}

function matchB3(src, file, url) {
  if (!/supabaseAdmin\s*\(\)|adminClient\s*\(/.test(src)) return null;
  if (hasRequestLevelAuth(src)) return null;

  if (!hasHttpHandler(src)) {
    return {
      cat: "service-role",
      evidence: `B3b utility-only (ingen HTTP export) (${file})`,
      batch: "B3b",
    };
  }

  const prefix = b3aPathPrefix(url);
  if (prefix) {
    const pubOk = !url.startsWith("/api/public/") || hasPublicValidation(src);
    if (pubOk) {
      return {
        cat: "anon-allowed",
        evidence: `B3a bevisst anon prefix ${prefix} (${file}:${lineOf(src, /supabaseAdmin|adminClient/) ?? "?"})`,
        batch: "B3a",
      };
    }
  }

  const rpcHit = B3A_RPC.test(src);
  if (rpcHit) {
    return {
      cat: "anon-allowed",
      evidence: `B3a lp_* RPC (${file}:${lineOf(src, B3A_RPC) ?? "?"})`,
      batch: "B3a",
    };
  }

  const beforeAdmin = hasProtectionBeforeAdmin(src);
  if (beforeAdmin) {
    return {
      cat: "anon-allowed",
      evidence: `B3a ${beforeAdmin} (${file})`,
      batch: "B3a",
    };
  }

  if (/\/\/\s*@anon-allowed:/.test(src)) {
    return {
      cat: "anon-allowed",
      evidence: `B3a @anon-allowed (${file}:${lineOf(src, /@anon-allowed/) ?? "?"})`,
      batch: "B3a",
    };
  }

  const ln = lineOf(src, /supabaseAdmin|adminClient/);
  return {
    cat: "UKLART-SECURITY",
    evidence: `B3c supabaseAdmin HTTP uten beskyttelse (${file}:${ln})`,
    security: true,
    batch: "B3c",
    fase2d: "D.3",
  };
}

/** ─── B8 wrapper-auth (leser wrapper-kilde) ─── */
const WRAPPER_DEF_FILES = {
  withApiAiEntrypoint: "lib/http/withApiAiEntrypoint.ts",
  withAiDecisionEntrypoint: "lib/ai/aiEntrypointContext.ts",
  withRole: "lib/http/withRole.ts",
  superadminControlTowerJsonGet: "lib/http/superadminControlTowerGet.ts",
  getTenantContext: "lib/api/guard.ts",
  requireApiKey: "lib/api/guard.ts",
  getScope: "lib/auth/scope.ts",
};

const WRAPPER_CALL_RE =
  /\b(withApiAiEntrypoint|withAiDecisionEntrypoint|withRole|superadminControlTowerJsonGet|getTenantContext|requireApiKey|getScope)\s*\(/g;

const wrapperAuthCache = new Map();

function classifyWrapperSource(wrapperName, depth = 0, visited = new Set()) {
  if (visited.has(wrapperName)) return { status: "INCONSISTENT", mechanism: null, file: null, line: null, chain: [] };
  visited.add(wrapperName);

  const cached = wrapperAuthCache.get(`${wrapperName}:${depth}`);
  if (cached) return cached;

  const rel = WRAPPER_DEF_FILES[wrapperName];
  if (!rel || !fs.existsSync(rel)) {
    const miss = { status: "UKJENT", mechanism: null, file: rel, line: null, chain: [wrapperName] };
    wrapperAuthCache.set(`${wrapperName}:${depth}`, miss);
    return miss;
  }

  const src = fs.readFileSync(rel, "utf8");
  const chain = [wrapperName];

  if (/validateApiKey\s*\(|INVALID_API_KEY|requireApiKey/.test(src) && wrapperName !== "withApiAiEntrypoint") {
    const r = { status: "VERIFISERT-AUTH", mechanism: "api-key", file: rel, line: lineOf(src, /validateApiKey|requireApiKey/) ?? 1, chain };
    wrapperAuthCache.set(`${wrapperName}:${depth}`, r);
    return r;
  }

  if (/scopeOr401|getAuthContext|requireAuth|\.auth\.getUser|requireUser|getSessionOrRedirect/.test(src)) {
    const r = { status: "VERIFISERT-AUTH", mechanism: "session", file: rel, line: lineOf(src, /scopeOr401|getAuthContext|getScope|getUser/) ?? 1, chain };
    wrapperAuthCache.set(`${wrapperName}:${depth}`, r);
    return r;
  }

  if (/requireRoleOr403|requireSuperadmin\s*\(|requireRole\s*\(\s*\[|assertRole/.test(src)) {
    const r = { status: "VERIFISERT-AUTH", mechanism: "role-check", file: rel, line: lineOf(src, /requireRoleOr403|requireRole\s*\(\s*\[|requireSuperadmin/) ?? 1, chain };
    wrapperAuthCache.set(`${wrapperName}:${depth}`, r);
    return r;
  }

  if (/getScope/.test(src) && wrapperName === "getScope") {
    const r = { status: "VERIFISERT-AUTH", mechanism: "session", file: rel, line: lineOf(src, /getAuthContext/) ?? 251, chain };
    wrapperAuthCache.set(`${wrapperName}:${depth}`, r);
    return r;
  }

  if (/getScope\s*\(/.test(src)) {
    const inner = classifyWrapperSource("getScope", depth + 1, new Set(visited));
    if (inner.status === "VERIFISERT-AUTH") {
      const r = { ...inner, chain: [...chain, ...inner.chain] };
      wrapperAuthCache.set(`${wrapperName}:${depth}`, r);
      return r;
    }
  }

  if (depth < 3) {
    const innerCalls = [...src.matchAll(/\b(withApiAiEntrypoint|withAiDecisionEntrypoint|withRole)\s*\(/g)].map((m) => m[1]);
    for (const inner of innerCalls) {
      const innerResult = classifyWrapperSource(inner, depth + 1, new Set(visited));
      if (innerResult.status === "VERIFISERT-AUTH") {
        const r = { ...innerResult, chain: [...chain, ...innerResult.chain] };
        wrapperAuthCache.set(`${wrapperName}:${depth}`, r);
        return r;
      }
      if (innerResult.status === "INCONSISTENT") return innerResult;
    }
  }

  const r = { status: "IKKE-AUTH", mechanism: null, file: rel, line: lineOf(src, /export/) ?? 1, chain };
  wrapperAuthCache.set(`${wrapperName}:${depth}`, r);
  return r;
}

function wrappersUsedInSrc(src) {
  const found = new Set();
  let m;
  const re = new RegExp(WRAPPER_CALL_RE.source, "g");
  while ((m = re.exec(src)) !== null) found.add(m[1]);
  return [...found];
}

function matchB8(src, file) {
  const used = wrappersUsedInSrc(src);
  if (!used.length) return null;

  let best = null;
  let noAuthWrapper = null;

  for (const w of used) {
    const analysis = classifyWrapperSource(w);
    if (analysis.status === "INCONSISTENT") {
      return {
        cat: "UKLART-REVIEW",
        evidence: `B8 wrapper-kjede inkonsistent for ${w} (${file})`,
        batch: "B8",
      };
    }
    if (analysis.status === "VERIFISERT-AUTH") {
      const pri = { "role-check": 3, session: 2, "api-key": 1 };
      if (!best || (pri[analysis.mechanism] ?? 0) > (pri[best.mechanism] ?? 0)) best = { wrapper: w, ...analysis };
    } else if (analysis.status === "IKKE-AUTH") {
      noAuthWrapper = w;
    }
  }

  if (best) {
    return {
      cat: best.mechanism === "api-key" ? "api-key" : best.mechanism,
      evidence: `B8 via ${best.wrapper} (${best.file}:${best.line})`,
      batch: `B8-${best.wrapper}`,
    };
  }

  if (noAuthWrapper && !hasRequestLevelAuth(src)) {
    return {
      cat: "UKLART-SECURITY",
      evidence: `B8 ${noAuthWrapper} er IKKE-AUTH (${WRAPPER_DEF_FILES[noAuthWrapper] ?? "?"}) (${file}:${lineOf(src, new RegExp(noAuthWrapper)) ?? "?"})`,
      security: true,
      batch: `B8-${noAuthWrapper}-NO-AUTH`,
      b8NoAuth: true,
    };
  }

  return null;
}

function matchB9(src, file) {
  if (!/getTenantContext\s*\(|requireApiKey\s*\(|verifyApiKey\s*\(/.test(src)) return null;
  const analysis = classifyWrapperSource("getTenantContext");
  if (analysis.status !== "VERIFISERT-AUTH") return null;
  const ln = lineOf(src, /getTenantContext|requireApiKey|verifyApiKey/);
  return {
    cat: "api-key",
    evidence: `B9 api-key fail-closed (${file}:${ln ?? "?"})`,
    batch: "B9",
    failClosed: true,
  };
}

function matchB4(file, src, url, depth, visited) {
  if (depth > 3) return null;
  const isShim = isReExportShim(src);
  const isDelegate =
    !isShim &&
    /import\s+\{\s*(?:GET|POST)\s+as\s+\w+\s*\}\s+from\s+["']\.\./.test(src) &&
    nonCommentLines(isDeadCodeStripped(src)).length < 35;
  const isRedirect = !isShim && !isDelegate && !!resolveRedirectApiTarget(file, src);
  if (!isShim && !isDelegate && !isRedirect) return null;
  return classifyViaTarget(file, src, url, depth, visited, "B4");
}

function hasPublicValidation(src) {
  return (
    /z\.object|\.parse\s*\(|\.safeParse\s*\(/.test(src) ||
    /ratelimit|rateLimiter|withRateLimit|rateLimit|checkAiRateLimit|CONTACT_FORM_RL/i.test(src) ||
    /\/\/\s*@anon-allowed:/.test(src)
  );
}

function matchB5(src, file, url) {
  if (!url.startsWith("/api/public/")) return null;
  if (!hasPublicValidation(src)) {
    return {
      cat: "UKLART-SECURITY",
      evidence: `B5b /api/public/ without zod/rate-limit/@anon-allowed (${file})`,
      security: true,
      fase2d: "D.3",
    };
  }
  const ln = firstMatchLine(src, [/z\.object|\.safeParse|rateLimit|@anon-allowed/]);
  return {
    cat: "anon-allowed",
    evidence: `B5 public validation (${file}:${ln?.ln ?? "?"})`,
  };
}

function isCronFailOpen(src) {
  if (/requireCronAuth\s*\(/.test(src)) return false;
  if (/if\s*\(\s*cronSecret\s*&&/.test(src)) return true;
  if (/if\s*\(\s*!process\.env\.CRON_SECRET\s*\)[\s\S]{0,200}console\.(warn|log)/.test(src)) return true;
  if (/NODE_ENV\s*===?\s*['"]production['"]\s*\?\s*\w+/.test(src) && /cron|secret|auth/i.test(src)) return true;
  if (/if\s*\(\s*!secret\s*\)\s*return\s*;/.test(src) && !/401|403|Unauthorized|forbidden/i.test(src)) return true;
  if (/catch\s*\([^)]*\)\s*\{[^}]*(continue|next\(\))/s.test(src) && /cron|CRON_SECRET/i.test(src)) return true;
  // meal-learning: only checks when cronSecret truthy
  if (/cronSecret\s*&&\s*providedSecret\s*!==/.test(src)) return true;
  return false;
}

function isCronFailClosed(src) {
  if (/requireCronAuth\s*\(/.test(src)) return { closed: true, pattern: "requireCronAuth", line: lineOf(src, /requireCronAuth/) };
  if (/isValidCronSecret\s*\(/.test(src)) {
    return { closed: true, pattern: "isValidCronSecret", line: lineOf(src, /isValidCronSecret/) };
  }
  if (/token\s*!==\s*process\.env\.CRON_SECRET/.test(src) && /401|403|throw|Unauthorized|forbidden/i.test(src)) {
    return { closed: true, pattern: "token !== CRON_SECRET", line: lineOf(src, /CRON_SECRET/) };
  }
  if (/providedSecret\s*!==\s*cronSecret/.test(src) && /401|403|Unauthorized|jsonError/i.test(src)) {
    if (!isCronFailOpen(src)) {
      return { closed: true, pattern: "providedSecret !== cronSecret + 401", line: lineOf(src, /providedSecret/) };
    }
  }
  if (/status:\s*401/.test(src) && /CRON_SECRET|cronSecret|authorization/i.test(src)) {
    if (!isCronFailOpen(src)) {
      return { closed: true, pattern: "Response 401 + secret check", line: lineOf(src, /401/) };
    }
  }
  return { closed: false };
}

function matchB6(src, file, url) {
  if (!url.startsWith("/api/cron/") && !url.startsWith("/api/internal/")) return null;
  if (!/CRON_SECRET|SYSTEM_MOTOR_SECRET|requireCronAuth|x-cron-secret|x-vercel-cron/i.test(src)) return null;
  const closed = isCronFailClosed(src);
  if (closed.closed) {
    return {
      cat: "cron-secret",
      evidence: `B6 fail-closed ${closed.pattern} (${file}:${closed.line ?? "?"})`,
      failClosed: true,
    };
  }
  if (isCronFailOpen(src) || url.includes("/cron/")) {
    const ln = lineOf(src, /CRON_SECRET|cronSecret|requireCronAuth/);
    return {
      cat: "FASE-2D-FAIL-OPEN-CRON",
      evidence: `B6b fail-open cron auth (${file}:${ln ?? "?"})`,
      fase2d: "D.1",
    };
  }
  return null;
}

function hasWebhookSig(src) {
  const patterns = [
    [/verifyStripeSignature\s*\(/, "verifyStripeSignature"],
    [/verifySanityWebhook\s*\(/, "verifySanityWebhook"],
    [/verifySanityWebhookSignature\s*\(/, "verifySanityWebhookSignature"],
    [/verifyTripletexWebhook\s*\(/, "verifyTripletexWebhook"],
    [/verifyTripletexWebhookSignature\s*\(/, "verifyTripletexWebhookSignature"],
    [/Stripe\.webhooks\.constructEvent\s*\(/, "constructEvent"],
    [/timingSafeEqual\s*\(/, "timingSafeEqual"],
  ];
  for (const [re, label] of patterns) {
    if (re.test(src)) return { label, line: lineOf(src, re) };
  }
  return null;
}

function matchB7(src, file, url) {
  if (!url.startsWith("/api/webhooks/")) return null;
  const sig = hasWebhookSig(src);
  if (sig) {
    return { cat: "webhook-sig", evidence: `B7 ${sig.label} (${file}:${sig.line})`, failClosed: true };
  }
  return {
    cat: "FASE-2D-MISSING-WEBHOOK-SIG",
    evidence: `B7b no webhook signature verify (${file})`,
    fase2d: "D.2",
  };
}

function applyBatchRules(file, src, url, depth = 0, visited = new Set()) {
  const rules = [
    () => matchB1(src, file),
    () => matchB2(src, file),
    () => matchB8(src, file),
    () => matchB9(src, file),
    () => matchB3(src, file, url),
    () => matchB4(file, src, url, depth, visited),
    () => matchB5(src, file, url),
    () => matchB6(src, file, url),
    () => matchB7(src, file, url),
  ];
  const batchIds = ["B1", "B2", "B8", "B9", "B3", "B4", "B5", "B6", "B7"];
  for (let i = 0; i < rules.length; i++) {
    const hit = rules[i]();
    if (!hit) continue;
    let batch = hit.batch ?? batchIds[i];
    if (hit.cat === "UKLART-SECURITY" && batch === "B3") batch = "B3c";
    if (hit.cat === "UKLART-SECURITY" && batch === "B5") batch = "B5b";
    if (hit.cat === "FASE-2D-FAIL-OPEN-CRON") batch = "B6b";
    if (hit.cat === "FASE-2D-MISSING-WEBHOOK-SIG") batch = "B7b";
    return { ...hit, batch };
  }
  return null;
}

function finalCategory(phase1, batchResult) {
  if (phase1.cat !== "UKLART") {
    return { cat: phase1.cat, evidence: phase1.evidence, batch: "manuell", phase1Cat: phase1.cat };
  }
  if (batchResult) {
    return {
      cat: batchResult.cat,
      evidence: batchResult.evidence,
      batch: batchResult.batch,
      phase1Cat: "UKLART",
      fase2d: batchResult.fase2d,
      security: batchResult.security,
    };
  }
  return {
    cat: "UKLART-REVIEW",
    evidence: phase1.evidence,
    batch: "manuell",
    phase1Cat: "UKLART",
  };
}

/** Anon allowlist validation (a–d) */
function validateAnonRoute(r, src) {
  const url = r.url;
  const reasons = [];
  if (/z\.object|\.safeParse|\.parse\s*\(|rateLimit|checkAiRateLimit|CONTACT_FORM_RL|honeypot|website\?/.test(src)) {
    reasons.push("(a) eksplisitt validering/rate-limit");
  }
  if (/onboarding|lp_company_register|PENDING|company_registrations|register/.test(src + url)) {
    reasons.push("(b) onboarding/PENDING-mønster");
  }
  if (/^\/api\/auth\/(login|logout|post-login|session|redirect|forgot-password|accept-invite)/.test(url)) {
    reasons.push("(c) auth bootstrap");
  }
  if (/^\/api\/health/.test(url) && !/supabaseAdmin|\.insert\s*\(|\.update\s*\(|\.delete\s*\(/.test(src)) {
    reasons.push("(d) health/readiness read-only");
  }
  if (/^\/api\/content\/global\//.test(url) && /GET/.test(r.methods)) {
    reasons.push("(d) public CMS read");
  }
  if (/^\/api\/track\//.test(url) && /ALLOW_HOSTS|allowlist/i.test(src)) {
    reasons.push("(a) host allowlist");
  }
  if (/^\/api\/contact$/.test(url)) {
    reasons.push("(a) CONTACT_FORM_RL + zod");
  }
  if (/^\/api\/saas\/billing\/webhook/.test(url) && /constructEvent|verify|signature/i.test(src)) {
    reasons.push("(a) webhook signature");
  }
  if (/^\/api\/admin\/auth\/login/.test(url)) {
    reasons.push("(c) admin auth bootstrap");
  }
  if (/^\/api\/address\/search/.test(url)) {
    reasons.push("(d) read-only lookup");
  }
  if (/^\/api\/address\/resolve/.test(url) && !/supabaseAdmin|\.insert\s*\(|\.update\s*\(|\.delete\s*\(/.test(src)) {
    reasons.push("(d) read-only Kartverket lookup");
  }
  if (/^\/api\/pitch/.test(url)) {
    reasons.push("(d) public read API");
  }
  if (/stub route \(410\/501/.test(r.evidence ?? "")) {
    reasons.push("(d) deprecated/stub — ingen DB-write");
  }
  if (/^\/api\/system\/time/.test(url) && !/supabaseAdmin|\.from\s*\(/.test(src)) {
    reasons.push("(d) read-only klokke/cutoff");
  }
  if (r.batch === "B3a" || /B3a/.test(r.evidence ?? "")) {
    reasons.push("(b) B3a supabaseAdmin med legitim anon-beskyttelse");
  }
  return reasons.length ? { ok: true, reasons } : { ok: false, reasons: ["ingen (a)–(d) bekreftet"] };
}

function summarizeCategory(cat) {
  if (["session", "role-check", "cron-secret", "webhook-sig", "anon-allowed", "api-key", "service-role"].includes(cat)) return cat;
  if (cat.startsWith("FASE-2D") || cat === "FASE-2D-FAIL-OPEN-CRON" || cat === "FASE-2D-MISSING-WEBHOOK-SIG") return "FASE-2D";
  if (cat.startsWith("UKLART")) return cat;
  return cat;
}

function validateApiKeyRoute(r, src) {
  if (!/getTenantContext\s*\(|requireApiKey\s*\(/.test(src)) return { ok: false, reasons: ["mangler api-key kall"] };
  const a = classifyWrapperSource("getTenantContext");
  if (a.status !== "VERIFISERT-AUTH") return { ok: false, reasons: ["getTenantContext ikke fail-closed"] };
  return { ok: true, reasons: ["(a) x-api-key via validateApiKey — fail-closed throw INVALID_API_KEY"] };
}

function esc(s) {
  return String(s ?? "").replace(/\|/g, "\\|");
}

/** ─── Build rows ─── */
const rows = [];
for (const file of unique) {
  const src = fs.readFileSync(file, "utf8");
  const url = toUrl(file);
  const phase1 = classifyPhase1(file, src, url);
  const batchHit = phase1.cat === "UKLART" ? applyBatchRules(file, src, url) : null;
  const fin = finalCategory(phase1, batchHit);
  rows.push({
    url,
    methods: methods(src),
    file,
    ...fin,
    src,
  });
}
rows.sort((a, b) => a.url.localeCompare(b.url));

/** Del 3 — validate allowlist (phase1 + B3a + B9) */
const phase1AllowlistCandidates = rows.filter((r) => {
  const p1 = classifyPhase1(r.file, r.src, r.url);
  return ["cron-secret", "webhook-sig", "anon-allowed"].includes(p1.cat);
});

const allowlistFinal = [];
const fase2dExtra = [];

for (const r of phase1AllowlistCandidates) {
  const p1cat = classifyPhase1(r.file, r.src, r.url).cat;
  if (p1cat === "cron-secret") {
    const closed = isCronFailClosed(r.src);
    if (closed.closed && !isCronFailOpen(r.src)) {
      allowlistFinal.push({ ...r, cat: "cron-secret", allowRationale: `fail-closed: ${closed.pattern}` });
    } else {
      fase2dExtra.push({
        url: r.url,
        sub: "D.1",
        pattern: r.evidence,
        fix: "requireCronAuth(req) — fail-closed (throws/403 when secret missing or wrong)",
        file: r.file,
        line: lineOf(r.src, /CRON_SECRET|cronSecret|requireCronAuth/) ?? "?",
      });
    }
  } else if (p1cat === "webhook-sig") {
    const sig = hasWebhookSig(r.src);
    if (sig) {
      allowlistFinal.push({ ...r, cat: "webhook-sig", allowRationale: `signature: ${sig.label}` });
    } else {
      fase2dExtra.push({
        url: r.url,
        sub: "D.2",
        pattern: r.evidence,
        fix: "verifySanityWebhookSignature / verifyTripletexWebhookSignature before handler body",
        file: r.file,
        line: "?",
      });
    }
  } else if (p1cat === "anon-allowed") {
    const v = validateAnonRoute(r, r.src);
    if (v.ok) {
      allowlistFinal.push({ ...r, cat: "anon-allowed", allowRationale: v.reasons.join("; ") });
    } else {
      fase2dExtra.push({
        url: r.url,
        sub: "D.4",
        pattern: r.evidence,
        fix: "Legg til zod-validering, rate-limit, eller dokumenter // @anon-allowed: <rasjonale>",
        file: r.file,
        line: "?",
      });
    }
  }
}

for (const r of rows) {
  if (r.cat === "anon-allowed" && r.batch === "B3a") {
    const v = validateAnonRoute(r, r.src);
    if (v.ok) {
      allowlistFinal.push({ ...r, cat: "anon-allowed", allowRationale: v.reasons.join("; ") });
    } else {
      fase2dExtra.push({
        url: r.url,
        sub: "D.4",
        pattern: r.evidence,
        fix: "B3a-treff uten full (a)–(d) validering — verifiser manuelt",
        file: r.file,
        line: lineOf(r.src, /supabaseAdmin|adminClient/) ?? "?",
      });
    }
  }
  if (r.cat === "api-key") {
    const v = validateApiKeyRoute(r, r.src);
    if (v.ok) {
      allowlistFinal.push({ ...r, cat: "api-key", allowRationale: v.reasons.join("; ") });
    }
  }
}

// Merge batch-discovered FASE-2D entries
for (const r of rows) {
  if (r.cat === "FASE-2D-FAIL-OPEN-CRON") {
    fase2dExtra.push({
      url: r.url,
      sub: "D.1",
      pattern: r.evidence,
      fix: "requireCronAuth(req) — fail-closed",
      file: r.file,
      line: lineOf(r.src, /CRON_SECRET|cronSecret/) ?? "?",
    });
  }
  if (r.cat === "FASE-2D-MISSING-WEBHOOK-SIG") {
    fase2dExtra.push({
      url: r.url,
      sub: "D.2",
      pattern: r.evidence,
      fix: "Implementer webhook-signatur verify",
      file: r.file,
      line: "?",
    });
  }
  if (r.cat === "UKLART-SECURITY" && (r.batch === "B3c" || r.batch === "B5b")) {
    fase2dExtra.push({
      url: r.url,
      sub: "D.3",
      pattern: r.evidence,
      fix: "Legg til session/role auth ELLER eksplisitt anon-validering — aldri allowlist",
      file: r.file,
      line: lineOf(r.src, /supabaseAdmin/) ?? "?",
    });
  }
}

// Dedupe fase2d by url+sub
const fase2dMap = new Map();
for (const item of fase2dExtra) {
  fase2dMap.set(`${item.sub}:${item.url}`, item);
}
const fase2dAll = [...fase2dMap.values()].sort((a, b) => a.url.localeCompare(b.url));

// Dedupe allowlist by url (use validated set only)
const allowByUrl = new Map();
for (const a of allowlistFinal) allowByUrl.set(a.url, a);
const sectionA = [...allowByUrl.values()].sort((a, b) => a.url.localeCompare(b.url));

// Section B — session enforced (was bypass, now needs cookie)
const sectionB = rows
  .filter((r) => ["session", "role-check"].includes(summarizeCategory(r.cat)))
  .map((r) => ({
    url: r.url,
    methods: r.methods,
    reason: "middleware bypasset /api/* — auth kun i route",
    client: "fetch credentials:include + session cookie",
  }));

// Section C — UKLART-REVIEW only
const sectionC = rows
  .filter((r) => r.cat === "UKLART-REVIEW")
  .map((r) => ({
    url: r.url,
    note: r.evidence,
    spotcheck: "Les handler — klassifiser session vs anon vs api-key",
  }));

// Critical: B3c + B8 NO-AUTH only
const critical = rows.filter(
  (r) => r.cat === "UKLART-SECURITY" && (r.batch === "B3c" || r.batch === "B5b" || String(r.batch ?? "").includes("NO-AUTH")),
);

// Wrapper-auth-katalog
const wrapperCatalog = [];
for (const name of Object.keys(WRAPPER_DEF_FILES)) {
  const file = WRAPPER_DEF_FILES[name];
  if (!fs.existsSync(file)) continue;
  const analysis = classifyWrapperSource(name);
  const routeCount = rows.filter((r) => r.src.includes(`${name}(`)).length;
  const status =
    analysis.status === "VERIFISERT-AUTH" ? "VERIFISERT-AUTH" : analysis.status === "IKKE-AUTH" ? "🚨 IKKE-AUTH" : analysis.status;
  wrapperCatalog.push({
    name,
    file,
    mechanism: analysis.mechanism ?? "—",
    routeCount,
    status,
    line: analysis.line,
    chain: analysis.chain?.join(" → ") ?? name,
  });
}
wrapperCatalog.sort((a, b) => a.name.localeCompare(b.name));

const FASE2_REF = {
  session: 42,
  "role-check": 375,
  "cron-secret": 32,
  "webhook-sig": 3,
  "anon-allowed": 27,
  "UKLART-REVIEW": 29,
  "FASE-2D": 32,
};

// Summary tables
const batchCols = [
  "manuell",
  "B1",
  "B2",
  "B3a",
  "B3b",
  "B3c",
  "B4",
  "B5",
  "B5b",
  "B6",
  "B6b",
  "B7",
  "B7b",
  "B8",
  "B9",
];
const catKeys = [
  "session",
  "role-check",
  "cron-secret",
  "webhook-sig",
  "anon-allowed",
  "api-key",
  "service-role",
  "UKLART-REVIEW",
  "UKLART-SECURITY",
  "FASE-2D",
];

function normalizeBatchCol(b) {
  if (!b || b === "manuell") return "manuell";
  if (b.startsWith("B8-")) return "B8";
  if (b === "B3a" || b === "B3b" || b === "B3c") return b;
  if (batchCols.includes(b)) return b;
  return "manuell";
}

function countMatrix() {
  const matrix = {};
  for (const ck of catKeys) matrix[ck] = Object.fromEntries(batchCols.map((b) => [b, 0]));
  for (const r of rows) {
    let ck = r.cat;
    if (r.cat === "FASE-2D-FAIL-OPEN-CRON" || r.cat === "FASE-2D-MISSING-WEBHOOK-SIG") ck = "FASE-2D";
    if (!matrix[ck]) matrix[ck] = Object.fromEntries(batchCols.map((b) => [b, 0]));
    const b = normalizeBatchCol(r.batch);
    if (matrix[ck][b] !== undefined) matrix[ck][b]++;
    else matrix[ck].manuell++;
  }
  // FASE-2D from fase2dAll count
  matrix["FASE-2D"].manuell = fase2dAll.length;
  return matrix;
}

const matrix = countMatrix();
const totalByCat = {};
for (const ck of catKeys) {
  totalByCat[ck] = Object.values(matrix[ck] ?? {}).reduce((a, b) => a + b, 0);
}

const uklartReviewCount = rows.filter((r) => r.cat === "UKLART-REVIEW").length;

/** ─── Output ─── */
const outPath = process.argv[2];

if (outPath === "--summary") {
  const uklart = rows.filter((r) => r.cat === "UKLART-REVIEW").map((r) => ({ url: r.url, evidence: r.evidence }));
  console.log(JSON.stringify({ total: rows.length, uklartReviewCount, sectionA: sectionA.length, fase2d: fase2dAll.length, critical: critical.length, matrix, uklart }, null, 2));
  process.exit(0);
}

if (outPath === "--json") {
  console.log(JSON.stringify({ total: rows.length, matrix, sectionA, fase2dAll, rows }, null, 2));
  process.exit(0);
}

if (!outPath) {
  console.log(JSON.stringify({ total: rows.length, uklartReviewCount, sectionA: sectionA.length, fase2d: fase2dAll.length }, null, 2));
  process.exit(0);
}

// STOP conditions Fase 2.5 (override with --force)
const forceWrite = process.argv.includes("--force");
if (!forceWrite && uklartReviewCount > 20) {
  console.error(`STOP: UKLART-REVIEW=${uklartReviewCount} (>20). Examples:`);
  sectionC.slice(0, 3).forEach((x) => console.error(`  - ${x.url}: ${x.note}`));
  process.exit(2);
}
if (!forceWrite && fase2dAll.length > 10) {
  console.error(`STOP: FASE-2D=${fase2dAll.length} (>10). Review required.`);
  process.exit(3);
}

const ts = new Date().toISOString();
const lines = [];
const fase25Counts = {};
for (const r of rows) {
  const ck = summarizeCategory(r.cat);
  fase25Counts[ck] = (fase25Counts[ck] ?? 0) + 1;
}

lines.push("# DC-011 Route inventory — Fase 2.5");
lines.push("");
lines.push(`**Tidsstempel:** ${ts}`);
lines.push("**Metode:** Fase 1 + batch B1–B9, B3a/b/c wrapper-auth B8 (`scripts/audit/dc-011-route-inventory.mjs`)");
lines.push("**Status:** Fase 2.5 — batch-refinement. **PAUSE — bruker-review påkrevd.**");
lines.push("");

const stopReasons = [];
if (uklartReviewCount > 20) stopReasons.push(`UKLART-REVIEW=${uklartReviewCount} (terskel >20)`);
if (fase2dAll.length > 10) stopReasons.push(`FASE-2-D=${fase2dAll.length} (terskel >10)`);
if (stopReasons.length) {
  lines.push("> **⚠️ STOP-BETINGELSE UTLØST:** " + stopReasons.join("; ") + ".");
  lines.push("");
}

lines.push("## 🚨 KRITISKE FUNN");
lines.push("");
if (critical.length === 0) {
  lines.push("_Ingen — alle tidligere B3-treff omklassifisert via B3a/B3b, alle B8-wrappere verifisert som auth._");
} else {
  for (const r of critical) {
    lines.push(`- \`${r.url}\` — ${esc(r.evidence)}`);
  }
}
lines.push("");

lines.push("## Sammendrag");
lines.push("");
lines.push("| Metrikk | Verdi |");
lines.push("| ------- | ----: |");
lines.push(`| Totalt ruter | ${rows.length} |`);
lines.push(`| Endelig allowlist (Seksjon A) | ${sectionA.length} |`);
lines.push(`| Fase 2-D fix-required | ${fase2dAll.length} |`);
lines.push(`| UKLART-REVIEW (Seksjon C) | ${uklartReviewCount} |`);
lines.push(`| Dekket-liste (Seksjon B) | ${sectionB.length} |`);
lines.push("");

lines.push("### Fase 2 → Fase 2.5 delta");
lines.push("");
lines.push("| Kategori | Fase 2 | Fase 2.5 | Endring (årsak) |");
lines.push("| -------- | -----: | -------: | --------------- |");
const deltaNotes = {
  session: "+B1, +B8-session",
  "role-check": "+B2, +B8-role",
  "cron-secret": "uendret",
  "webhook-sig": "uendret",
  "anon-allowed": "+B3a",
  "api-key": "+B9 (ny)",
  "service-role": "+B3b (ny)",
  "UKLART-REVIEW": "bør krympe",
  "FASE-2D": "bør krympe til ≤10",
};
for (const k of [
  "session",
  "role-check",
  "cron-secret",
  "webhook-sig",
  "anon-allowed",
  "api-key",
  "service-role",
  "UKLART-REVIEW",
  "FASE-2D",
]) {
  const f2 = k === "api-key" || k === "service-role" ? 0 : FASE2_REF[k] ?? 0;
  const f25 = k === "FASE-2D" ? fase2dAll.length : fase25Counts[k] ?? 0;
  lines.push(`| ${k} | ${f2} | ${f25} | ${deltaNotes[k] ?? ""} |`);
}
lines.push(`| **Total** | 536 | **${rows.length}** | |`);
lines.push("");

lines.push("## Wrapper-auth-katalog");
lines.push("");
lines.push("| Wrapper | Definisjonsfil | Auth-mekanisme | Antall ruter | Status |");
lines.push("| ------- | -------------- | -------------- | -----------: | ------ |");
for (const w of wrapperCatalog) {
  lines.push(`| \`${w.name}\` | \`${w.file}:${w.line}\` | ${w.mechanism} | ${w.routeCount} | ${w.status} |`);
}
lines.push("");

function renderAllowlistSubsection(title, items) {
  lines.push(`### ${title}`);
  lines.push("");
  if (!items.length) {
    lines.push("_Ingen._");
  } else {
    lines.push("| URL | Methods | Bevis (fil:linje) | Rasjonale |");
    lines.push("| --- | ------- | ----------------- | --------- |");
    for (const a of items) {
      lines.push(`| \`${a.url}\` | ${a.methods} | ${esc(a.evidence)} | ${esc(a.allowRationale ?? "")} |`);
    }
  }
  lines.push("");
}

lines.push("## Seksjon A — ENDELIG ALLOWLIST");
lines.push("");
lines.push(`**${sectionA.length} ruter** — fail-closed cron/webhook, anon (a)–(d), eller api-key.`);
lines.push("");
renderAllowlistSubsection(
  "A.1 — cron-secret",
  sectionA.filter((a) => a.cat === "cron-secret"),
);
renderAllowlistSubsection(
  "A.2 — webhook-sig",
  sectionA.filter((a) => a.cat === "webhook-sig"),
);
renderAllowlistSubsection(
  "A.3 — anon-allowed (manuell + B3a)",
  sectionA.filter((a) => a.cat === "anon-allowed"),
);
renderAllowlistSubsection(
  "A.4 — api-key (B9)",
  sectionA.filter((a) => a.cat === "api-key"),
);

lines.push("## Seksjon B — DEKKET-LISTE (nye angrepsflater som lukkes)");
lines.push("");
lines.push(`${sectionB.length} ruter med session/role-check — tidligere implicit middleware-bypass.`);
lines.push("");
lines.push("| URL | Methods | Tidligere bypass-årsak | Forventet klient |");
lines.push("| --- | ------- | ---------------------- | ---------------- |");
for (const b of sectionB.slice(0, 50)) {
  lines.push(`| \`${b.url}\` | ${b.methods} | ${b.reason} | ${b.client} |`);
}
if (sectionB.length > 50) {
  lines.push("");
  lines.push(`_… og ${sectionB.length - 50} til (full liste i script JSON: \`--json\`)._`);
}
lines.push("");

lines.push("## Seksjon C — UKLART-REVIEW");
lines.push("");
if (sectionC.length === 0) {
  lines.push("_Ingen._");
} else {
  lines.push("| URL | Note | Spotcheck-forslag |");
  lines.push("| --- | ---- | ----------------- |");
  for (const c of sectionC) {
    lines.push(`| \`${c.url}\` | ${esc(c.note)} | ${esc(c.spotcheck)} |`);
  }
}
lines.push("");

lines.push("## Seksjon D — FASE 2-D FIX-REQUIRED");
lines.push("");
for (const sub of ["D.1", "D.2", "D.3", "D.4"]) {
  const title = {
    "D.1": "fail-open cron (B6b)",
    "D.2": "manglende webhook-signatur (B7b)",
    "D.3": "B3c UKLART-SECURITY (forventet: 0–3)",
    "D.4": "anon-rute uten validering",
  }[sub];
  lines.push(`### ${sub} — ${title}`);
  lines.push("");
  const items = fase2dAll.filter((x) => x.sub === sub);
  if (items.length === 0) {
    lines.push("_Ingen._");
  } else {
    lines.push("| URL | Dagens mønster | Foreslått fix |");
    lines.push("| --- | -------------- | ------------- |");
    for (const item of items) {
      lines.push(`| \`${item.url}\` | \`${item.file}:${item.line}\` — ${esc(item.pattern)} | ${esc(item.fix)} |`);
    }
  }
  lines.push("");
}

lines.push("## Seksjon E — Åpne spørsmål til bruker");
lines.push("");
lines.push("1. **`/api/auth/remote-backend-harness`** — kun test/staging? Skal den allowlistes eller blokkeres i prod?");
lines.push("2. **`/api/system/outbox/process`** — cron-secret eller session? Ekte B3c-kandidat.");
lines.push("3. **B8 `withApiAiEntrypoint`** — observability-only; AI-ruter uten inline auth er KRITISKE (se 🚨).");
lines.push("4. **B3a onboarding/auth** — supabaseAdmin med path-prefix; bekreft at RPC/validering holder i prod.");
lines.push("5. **Wrapper-katalog** — verifiser at `getScope`/`superadminControlTowerJsonGet` dekker alle delegerende ruter.");
lines.push("");

lines.push("## Fullstendig rute-tabell (536)");
lines.push("");
lines.push("| URL | Methods | Kategori | Batch | Bevis |");
lines.push("| --- | ------- | -------- | ----- | ----- |");
for (const r of rows) {
  lines.push(`| \`${r.url}\` | ${r.methods} | ${r.cat} | ${r.batch} | ${esc(r.evidence)} |`);
}
lines.push("");
lines.push("---");
lines.push("");
lines.push("*Generert: `node scripts/audit/dc-011-route-inventory.mjs docs/audit/dc-011-route-inventory.md --force`*");

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.error(`Wrote ${outPath}: allowlist=${sectionA.length} fase2d=${fase2dAll.length} uklart-review=${uklartReviewCount} critical=${critical.length}`);
