#!/usr/bin/env node
/**
 * PHASE 13 — Immutable release manifest (exact SHA + migration checksums).
 *
 * Writes docs/rc/phase13-release-manifest.md (tracked) and optionally
 * .backups/phase13-release-manifest-<stamp>.json (gitignored evidence copy).
 *
 * Usage:
 *   node scripts/verify/generate-release-manifest.mjs
 *   node scripts/verify/generate-release-manifest.mjs --write-json
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const writeJson = process.argv.includes("--write-json");
const migrationsDir = path.join("supabase", "migrations");
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort();

function sha256File(relPath) {
  const buf = fs.readFileSync(relPath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function git(cmd) {
  const r = spawnSync("git", cmd, { encoding: "utf8", cwd: process.cwd() });
  if (r.status !== 0) return "";
  return (r.stdout ?? "").trim();
}

const headSha = git(["rev-parse", "HEAD"]) || "UNKNOWN";
const headShort = git(["rev-parse", "--short", "HEAD"]) || headSha.slice(0, 8);
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) || "UNKNOWN";
const generatedAt = new Date().toISOString();

const checksums = migrationFiles.map((file) => ({
  file,
  version: file.slice(0, 14),
  sha256: sha256File(path.join(migrationsDir, file)),
}));

const phase13Migrations = checksums.filter((c) =>
  ["20260827120000", "20260827130000"].includes(c.version),
);

const manifest = {
  kind: "phase13-staging-rc-release-manifest",
  generatedAt,
  git: { headSha, headShort, branch },
  migrationCount: checksums.length,
  phase13Migrations: phase13Migrations.map((c) => ({ version: c.version, file: c.file, sha256: c.sha256 })),
  migrations: checksums,
};

const checksumBlock = checksums.map((c) => `${c.sha256}  ${c.file}`).join("\n");

const md = `# PHASE 13 — Immutable release manifest

**Generert:** ${generatedAt}  
**Git HEAD:** \`${headSha}\` (branch \`${branch}\`)  
**Migrasjoner:** ${checksums.length} lokale filer (SHA256 nedenfor)

> Dette manifestet låser release-identiteten for Fase 13 staging RC-beviset.
> Production-cutover krever nytt manifest med eget SHA etter godkjent staging-PASS.

## Phase 13 schema-endringer (P0 funnet under 21-lands RC-bevis)

| Versjon | Fil | SHA256 |
|---------|-----|--------|
${phase13Migrations.map((c) => `| ${c.version} | ${c.file} | \`${c.sha256}\` |`).join("\n")}

## Alle migrasjoner — SHA256

\`\`\`text
${checksumBlock}
\`\`\`

## Verifikasjon

\`\`\`bash
# Reproduser checksum-linje for én fil:
# certutil -hashfile supabase/migrations/<fil> SHA256   # Windows
# shasum -a 256 supabase/migrations/<fil>               # macOS/Linux

git rev-parse HEAD   # skal matche ${headShort}
\`\`\`
`;

fs.mkdirSync("docs/rc", { recursive: true });
const mdPath = path.join("docs/rc", "phase13-release-manifest.md");
fs.writeFileSync(mdPath, md, "utf8");
console.log(`OK: manifest skrevet → ${mdPath} (HEAD ${headShort}, ${checksums.length} migrasjoner)`);

if (writeJson) {
  fs.mkdirSync(".backups", { recursive: true });
  const stamp = generatedAt.slice(0, 19).replace(/[:T]/g, "-");
  const jsonPath = path.join(".backups", `phase13-release-manifest-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`OK: JSON-kopi → ${jsonPath}`);
}
