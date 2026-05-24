#!/usr/bin/env node
/** Git history secret pattern scan (extended set) — READ-ONLY audit */
import { execSync } from "node:child_process";

const patterns = [
  { id: "aws_key", re: /AKIA[0-9A-Z]{16}/ },
  { id: "github_pat", re: /ghp_[A-Za-z0-9]{20,}/ },
  { id: "github_oauth", re: /gho_[A-Za-z0-9]{20,}/ },
  { id: "supabase_jwt", re: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { id: "stripe_sk", re: /sk_live_[A-Za-z0-9]{20,}/ },
  { id: "openai_sk", re: /sk-[A-Za-z0-9]{20,}/ },
  { id: "private_key", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: "service_role_literal", re: /service_role['"]\s*:\s*['"]eyJ/ },
  { id: "postgres_url", re: /postgres(?:ql)?:\/\/[^:]+:[^@\s]+@/ },
  { id: "vercel_token", re: /vercel_[A-Za-z0-9]{20,}/ },
  { id: "slack_token", re: /xox[baprs]-[A-Za-z0-9-]+/ },
  { id: "sentry_dsn_secret", re: /https:\/\/[a-f0-9]+@[a-z0-9.-]+\.ingest\.sentry\.io/ },
];

function gitLogPaths() {
  return execSync('git log --all --pretty=format: --name-only -- "*.env*" "*.json" "*.sql" "*.md" "*.ts" "*.tsx" "*.yml" "*.yaml" "*.mjs"', {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  })
    .split(/\r?\n/)
    .filter(Boolean);
}

const uniquePaths = [...new Set(gitLogPaths())].slice(0, 5000);
const hits = [];

for (const p of uniquePaths) {
  let content;
  try {
    content = execSync(`git show HEAD:"${p.replace(/"/g, '\\"')}"`, { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
  } catch {
    continue;
  }
  for (const { id, re } of patterns) {
    if (re.test(content)) hits.push({ pattern: id, file: p, sample: content.match(re)?.[0]?.slice(0, 40) + "…" });
  }
}

// Also scan full history blobs for high-signal patterns (limited)
let historyHits = [];
try {
  const log = execSync(
    'git log --all -p -S "SUPABASE_SERVICE_ROLE" --pretty=format:"COMMIT %H" --max-count=20',
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (log.includes("eyJ")) historyHits.push({ pattern: "service_role_in_diff", commits: (log.match(/^COMMIT /gm) || []).length });
} catch {}

console.log(JSON.stringify({ scanned_head_files: uniquePaths.length, head_hits: hits.slice(0, 30), head_hit_count: hits.length, history_service_role: historyHits }, null, 2));
