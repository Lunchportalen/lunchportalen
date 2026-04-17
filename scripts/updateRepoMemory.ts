/**
 * Incremental update: git-changed files re-scanned, merged into repo-map, derived JSON rebuilt.
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import {
  collectFiles,
  scanFileContent,
  scanAllFileEntries,
  writeRepoIntelligence,
  type RepoFileEntry,
} from "./scanRepo";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MAP_PATH = path.join(ROOT, "repo-intelligence", "repo-map.json");

const SCAN_ROOTS = new Set(["app", "lib", "supabase", "components", "scripts"]);

function isScannable(rel: string): boolean {
  const norm = rel.replace(/\\/g, "/");
  const top = norm.split("/")[0];
  if (!SCAN_ROOTS.has(top)) return false;
  return /\.(ts|tsx|mjs)$/.test(norm);
}

function readUtf8(p: string): string {
  return fs.readFileSync(p, "utf8");
}

function getGitChangedFiles(): string[] | null {
  try {
    const unstaged = execSync("git diff --name-only HEAD", { cwd: ROOT, encoding: "utf8" });
    const untracked = execSync("git ls-files --others --exclude-standard", { cwd: ROOT, encoding: "utf8" });
    const lines = [...unstaged.split("\n"), ...untracked.split("\n")].filter(Boolean);
    return [...new Set(lines)];
  } catch {
    return null;
  }
}

function loadExistingMap(): RepoFileEntry[] {
  if (!fs.existsSync(MAP_PATH)) return [];
  try {
    const raw = JSON.parse(readUtf8(MAP_PATH)) as { files?: RepoFileEntry[] };
    return Array.isArray(raw.files) ? raw.files : [];
  } catch {
    return [];
  }
}

function mergeRepoMap(
  existing: RepoFileEntry[],
  allCurrentRelPaths: string[],
  changedRelPaths: Set<string>
): RepoFileEntry[] {
  const byPath = new Map(existing.map((f) => [f.path.replace(/\\/g, "/"), f]));
  const out: RepoFileEntry[] = [];

  for (const rel of allCurrentRelPaths) {
    const p = rel.replace(/\\/g, "/");
    const abs = path.join(ROOT, p);
    const needRescan = changedRelPaths.has(p) || !byPath.has(p);
    if (needRescan) {
      try {
        out.push(scanFileContent(p, readUtf8(abs)));
      } catch {
        /* skip */
      }
    } else {
      const prev = byPath.get(p);
      if (prev) out.push(prev);
    }
  }
  return out;
}

function run() {
  const started = new Date().toISOString();
  const allCurrent = collectFiles();
  const gitChanged = getGitChangedFiles();

  if (gitChanged === null) {
    console.log("[updateRepoMemory] git unavailable — full scan");
    const files = scanAllFileEntries();
    writeRepoIntelligence(files, started);
    console.log(`[updateRepoMemory] wrote ${files.length} files`);
    return;
  }

  const changedInScope = new Set(
    gitChanged.filter(isScannable).map((p) => p.replace(/\\/g, "/"))
  );

  if (changedInScope.size === 0 && fs.existsSync(MAP_PATH)) {
    console.log("[updateRepoMemory] no changes in scanned roots — touching meta only");
    const existing = loadExistingMap();
    writeRepoIntelligence(existing, started);
    return;
  }

  if (!fs.existsSync(MAP_PATH) || loadExistingMap().length === 0) {
    console.log("[updateRepoMemory] no existing map — full scan");
    const files = scanAllFileEntries();
    writeRepoIntelligence(files, started);
    console.log(`[updateRepoMemory] wrote ${files.length} files`);
    return;
  }

  const existing = loadExistingMap();
  const merged = mergeRepoMap(existing, allCurrent, changedInScope);
  writeRepoIntelligence(merged, started);
  console.log(`[updateRepoMemory] incremental merge → ${merged.length} files (changed: ${changedInScope.size})`);
}

run();
