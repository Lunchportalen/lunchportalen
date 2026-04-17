/**
 * Deterministic repo scanner for repo-intelligence/*.json
 * Scans: app/**, lib/**, supabase/**, components/**, scripts/**
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "repo-intelligence");

const SCAN_GLOBS = ["app", "lib", "supabase", "components", "scripts"] as const;
const EXT = "**/*.{ts,tsx,mjs}";

const KEYWORDS = ["lead_pipeline", "orders", "social_posts"] as const;

export type FileKind = "route" | "api" | "layout" | "lib" | "component" | "script" | "supabase" | "other";

export type RepoFileEntry = {
  path: string;
  type: FileKind;
  imports: string[];
  exports: string[];
  uses_tables: string[];
  rpc_calls: string[];
  keywords_hit: string[];
  fetch_urls: string[];
  http_methods: string[];
};

function readUtf8(p: string): string {
  return fs.readFileSync(p, "utf8");
}

function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/** Normalize to forward slashes relative to ROOT */
function rel(p: string): string {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

function classify(absPath: string): FileKind {
  const r = rel(absPath).replace(/\\/g, "/");
  if (r.endsWith("/page.tsx") || r.endsWith("\\page.tsx")) return "route";
  if (
    r.startsWith("app/") &&
    (r.endsWith("/route.ts") || r.endsWith("/route.tsx"))
  ) {
    return "api";
  }
  if (r.endsWith("/layout.tsx")) return "layout";
  if (r.startsWith("components/")) return "component";
  if (r.startsWith("lib/")) return "lib";
  if (r.startsWith("scripts/")) return "script";
  if (r.startsWith("supabase/")) return "supabase";
  return "other";
}

/** app/(group)/x/page.tsx -> /x ; app/page.tsx -> / */
export function pagePathToUrl(fileRel: string): string {
  let s = fileRel.replace(/\\/g, "/").replace(/^app\//, "");
  s = s.replace(/\/page\.tsx$/, "");
  s = s.replace(/\([^/]+\)\//g, "");
  s = s.replace(/\([^/]+\)$/g, "");
  if (!s || s === "page.tsx") return "/";
  const parts = s.split("/").filter(Boolean);
  return "/" + parts.map((p) => p.replace(/^\[(.+)\]$/, "[$1]")).join("/");
}

/** app/api/foo/route.ts -> /api/foo ; app/admin/x/route.ts -> /admin/x */
export function apiFileToRoute(fileRel: string): string | null {
  const norm = fileRel.replace(/\\/g, "/");
  const apiUnder = norm.match(/^app\/api\/(.+)\/route\.tsx?$/);
  if (apiUnder) return "/api/" + apiUnder[1];
  const anyApp = norm.match(/^app\/(.+)\/route\.tsx?$/);
  if (anyApp) return "/" + anyApp[1];
  return null;
}

function extractImports(source: string): string[] {
  const out = new Set<string>();
  for (const line of source.split(/\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    const fromM = trimmed.match(/\bfrom\s+['"]([^'"]+)['"]/);
    if (fromM) out.add(fromM[1]);
    const sideEffect = trimmed.match(/^import\s+['"]([^'"]+)['"]\s*;?$/);
    if (sideEffect) out.add(sideEffect[1]);
    const dyn = trimmed.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (dyn) out.add(dyn[1]);
  }
  return [...out].sort();
}

function extractExports(source: string): string[] {
  const out = new Set<string>();
  if (/export\s+default\b/.test(source)) out.add("default");
  const named = source.matchAll(
    /export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)|export\s+let\s+(\w+)|export\s+class\s+(\w+)|export\s+type\s+(\w+)|export\s+interface\s+(\w+)/g
  );
  for (const m of named) {
    for (let i = 1; i < m.length; i++) {
      if (m[i]) out.add(m[i]);
    }
  }
  return [...out].sort();
}

const FROM_RE = /\.from\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function extractSupabaseTables(source: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(FROM_RE.source, "g");
  while ((m = re.exec(source)) !== null) {
    out.add(m[1]);
  }
  return [...out].sort();
}

const RPC_RE = /\.rpc\s*\(\s*['"]([^'"]+)['"]/g;

function extractRpcNames(source: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(RPC_RE.source, "g");
  while ((m = re.exec(source)) !== null) {
    out.add(m[1]);
  }
  return [...out].sort();
}

const METHOD_RE = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

function extractHttpMethods(source: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(METHOD_RE.source, "g");
  while ((m = re.exec(source)) !== null) {
    out.add(m[1]);
  }
  return [...out].sort();
}

const FETCH_RE = /fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/g;

function extractFetchUrls(source: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(FETCH_RE.source, "g");
  while ((m = re.exec(source)) !== null) {
    const u = m[1].trim();
    if (u.startsWith("/") || u.startsWith("http")) out.add(u.split("?")[0]);
  }
  return [...out].sort();
}

function keywordHits(source: string): string[] {
  const hits: string[] = [];
  for (const k of KEYWORDS) {
    if (source.includes(k)) hits.push(k);
  }
  return hits;
}

/** Resolve import specifier to project-relative path if internal */
function resolveImport(fromFileRel: string, spec: string): string | null {
  if (spec.startsWith("@/")) {
    const sub = spec.slice(2);
    const candidates = [
      path.join(ROOT, sub + ".ts"),
      path.join(ROOT, sub + ".tsx"),
      path.join(ROOT, sub, "index.ts"),
      path.join(ROOT, sub, "index.tsx"),
      path.join(ROOT, "lib", sub.replace(/^lib\//, "") + ".ts"),
    ];
    for (const c of candidates) {
      if (exists(c)) return rel(c);
    }
    const tryPaths = path.join(ROOT, sub);
    if (exists(tryPaths + ".ts")) return rel(tryPaths + ".ts");
    if (exists(tryPaths + ".tsx")) return rel(tryPaths + ".tsx");
    if (exists(path.join(tryPaths, "index.ts"))) return rel(path.join(tryPaths, "index.ts"));
    if (exists(path.join(tryPaths, "index.tsx"))) return rel(path.join(tryPaths, "index.tsx"));
    return null;
  }
  if (spec.startsWith(".")) {
    const dir = path.dirname(path.join(ROOT, fromFileRel));
    const resolved = path.normalize(path.join(dir, spec));
    const relP = rel(resolved);
    const withTs = [relP, relP + ".ts", relP + ".tsx", relP + "/index.ts", relP + "/index.tsx"];
    for (const w of withTs) {
      const abs = path.join(ROOT, w);
      if (exists(abs)) return w.split("\\").join("/");
    }
  }
  return null;
}

export function scanFileContent(fileRel: string, source: string): RepoFileEntry {
  const type = classify(path.join(ROOT, fileRel));
  const imports = extractImports(source);
  const tables = extractSupabaseTables(source);
  const rpcs = extractRpcNames(source);
  return {
    path: fileRel.split("\\").join("/"),
    type,
    imports,
    exports: extractExports(source),
    uses_tables: [...new Set(tables)].sort(),
    rpc_calls: [...new Set(rpcs)].sort(),
    keywords_hit: keywordHits(source),
    fetch_urls: extractFetchUrls(source),
    http_methods:
      fileRel.startsWith("app/") && (fileRel.endsWith("route.ts") || fileRel.endsWith("route.tsx"))
        ? extractHttpMethods(source)
        : [],
  };
}

export function scanFile(fileRel: string): RepoFileEntry | null {
  const abs = path.join(ROOT, fileRel);
  if (!exists(abs)) return null;
  return scanFileContent(fileRel.split("\\").join("/"), readUtf8(abs));
}

export function collectFiles(): string[] {
  const all: string[] = [];
  for (const root of SCAN_GLOBS) {
    const pattern = path.join(ROOT, root, EXT).split("\\").join("/");
    const files = glob.sync(pattern, {
      nodir: true,
      ignore: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
    });
    all.push(...files.map((f) => rel(f)));
  }
  return [...new Set(all)].sort();
}

export function loadPublicTableNames(): Set<string> {
  const dbTypes = path.join(ROOT, "lib/types/database.ts");
  if (!exists(dbTypes)) return new Set();
  const s = readUtf8(dbTypes);
  const set = new Set<string>();
  const start = s.indexOf("PUBLIC_TABLE_NAMES = [");
  if (start < 0) return set;
  const end = s.indexOf("] as const", start);
  if (end < 0) return set;
  const slice = s.slice(start, end);
  const re = /"([a-z_][a-z0-9_]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    set.add(m[1]);
  }
  return set;
}

export function buildDependencyGraph(files: RepoFileEntry[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  for (const f of files) {
    const edges: string[] = [];
    for (const spec of f.imports) {
      const resolved = resolveImport(f.path, spec);
      if (resolved) edges.push(resolved);
    }
    graph[f.path] = [...new Set(edges)].sort();
  }
  return graph;
}

export function buildRoutes(files: RepoFileEntry[]) {
  return files
    .filter((f) => f.path.endsWith("/page.tsx") || f.path.endsWith("page.tsx"))
    .map((f) => ({
      file: f.path,
      url_path: pagePathToUrl(f.path),
      fetch_urls: f.fetch_urls,
      uses_tables: f.uses_tables,
      confidence: "confirmed" as const,
    }))
    .sort((a, b) => a.url_path.localeCompare(b.url_path));
}

export function buildApiMap(files: RepoFileEntry[]) {
  return files
    .filter((f) => f.type === "api")
    .map((f) => {
      const route = apiFileToRoute(f.path);
      return {
        route: route ?? f.path,
        file: f.path,
        methods: f.http_methods.length ? f.http_methods : ["UNKNOWN"],
        uses_tables: f.uses_tables,
        rpc_calls: f.rpc_calls,
        confidence: "confirmed" as const,
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

export function buildDbMap(files: RepoFileEntry[]) {
  const tables: Record<string, { used_in: string[] }> = {};
  for (const f of files) {
    for (const t of f.uses_tables) {
      if (!tables[t]) tables[t] = { used_in: [] };
      if (!tables[t].used_in.includes(f.path)) tables[t].used_in.push(f.path);
    }
  }
  for (const k of Object.keys(tables)) {
    tables[k].used_in.sort();
  }
  return { tables };
}

export function buildFlows(
  apiMap: ReturnType<typeof buildApiMap>,
  dbMap: { tables: Record<string, { used_in: string[] }> }
) {
  const has = (route: string) => apiMap.some((a) => a.route === route);
  const tableUsers = (t: string) => dbMap.tables[t]?.used_in ?? [];

  const flows: Array<{
    name: string;
    confidence: "high" | "partial";
    steps: string[];
    inference: string;
  }> = [];

  const s1 = has("/api/social/redirect");
  const s2 = has("/api/contact");
  const s3 = tableUsers("social_posts").length > 0;
  const s4 = tableUsers("lead_pipeline").length > 0;
  const s5 = tableUsers("orders").length > 0;

  if (s1 && s2 && s3 && s4 && s5) {
    flows.push({
      name: "social_to_revenue",
      confidence: "high",
      steps: [
        "social_posts",
        "/api/social/redirect",
        "/kontakt",
        "/api/contact",
        "lead_pipeline",
        "/api/orders",
        "orders",
      ],
      inference:
        "Confirmed API files and tables exist; /kontakt is the redirect target in app/api/social/redirect (not re-verified here).",
    });
  } else {
    flows.push({
      name: "social_to_revenue",
      confidence: "partial",
      steps: [
        ...(s3 ? ["social_posts"] : []),
        ...(s1 ? ["/api/social/redirect"] : []),
        ...(s2 ? ["/api/contact"] : []),
        ...(s4 ? ["lead_pipeline"] : []),
        ...(s5 ? ["orders"] : []),
      ],
      inference: "Missing prerequisite routes or table references in scanned files.",
    });
  }

  return { flows };
}

/**
 * Match fetch() URLs captured from template literals (e.g. `/api/x/${id}`) to Next App Router files
 * under `app/api/.../[segment]/route.ts`.
 * Template fragments like `${qs}` (query string only) are stripped; path segments become `*` so any
 * dynamic folder name (`[id]`, `[companyId]`, `[runId]`, …) matches.
 */
function apiRouteFileExistsForPath(apiPath: string): boolean {
  let noQuery = apiPath.split("?")[0] ?? "";
  if (noQuery.includes("${")) {
    noQuery = noQuery.replace(/\$\{(qs|searchParams|queryString|qsWithLeadingQ)\}/gi, "");
    noQuery = noQuery.replace(/\$\{[^}]+\}/g, "[id]");
    /** Truncated template capture (e.g. `${params.toString()` without `}`) */
    noQuery = noQuery.replace(/\$\{[^}]*$/g, "");
  }
  const collapsed = noQuery.replace(/\/+/g, "/").replace(/\/+$/, "");
  if (!collapsed.startsWith("/api")) return true;
  const parts = collapsed.replace(/^\//, "").split("/").filter(Boolean);
  const relGlob = parts.map((seg) => (seg === "[id]" ? "*" : seg)).join("/");
  const posix = path.join(ROOT, "app", relGlob, "route.ts").split(path.sep).join("/");
  if (glob.sync(posix, { nodir: true }).length > 0) return true;
  const posixX = path.join(ROOT, "app", relGlob, "route.tsx").split(path.sep).join("/");
  return glob.sync(posixX, { nodir: true }).length > 0;
}

export function buildErrors(
  files: RepoFileEntry[],
  dbMap: { tables: Record<string, { used_in: string[] }> },
  publicTables: Set<string>
) {
  const gaps: Array<{ type: string; description: string; files?: string[] }> = [];

  for (const [table, meta] of Object.entries(dbMap.tables)) {
    if (!publicTables.has(table)) {
      gaps.push({
        type: "table_not_in_database_ts",
        description: `Table "${table}" appears in .from() but is not listed in lib/types/database.ts PUBLIC_TABLE_NAMES (or parse failed).`,
        files: meta.used_in.slice(0, 20),
      });
    }
  }

  const referencedApi = new Set<string>();
  for (const f of files) {
    for (const u of f.fetch_urls) {
      if (u.startsWith("/api/")) referencedApi.add(u.replace(/\/$/, ""));
    }
  }
  for (const a of referencedApi) {
    if (apiRouteFileExistsForPath(a)) continue;
    gaps.push({
      type: "fetch_reference_unresolved",
      description: `fetch() references ${a} but no matching app/api/**/route.ts found at conventional path.`,
    });
  }

  const layouts = files.filter((f) => f.type === "layout");
  for (const lay of layouts) {
    const dir = path.dirname(path.join(ROOT, lay.path));
    const pattern = path.join(dir, "**/page.tsx").split("\\").join("/");
    const pages = glob.sync(pattern, { nodir: true });
    if (pages.length === 0) {
      gaps.push({
        type: "layout_without_pages",
        description: `Layout ${lay.path} has no nested page.tsx under its tree.`,
      });
    }
  }

  return { gaps };
}

export function scanAllFileEntries(): RepoFileEntry[] {
  const fileRels = collectFiles();
  const files: RepoFileEntry[] = [];
  for (const fr of fileRels) {
    const abs = path.join(ROOT, fr);
    try {
      files.push(scanFileContent(fr, readUtf8(abs)));
    } catch {
      /* skip binary or unreadable */
    }
  }
  return files;
}

export function writeRepoIntelligence(files: RepoFileEntry[], startedIso: string) {
  const publicTables = loadPublicTableNames();
  const graph = buildDependencyGraph(files);
  const routes = buildRoutes(files);
  const apiMap = buildApiMap(files);
  const dbMap = buildDbMap(files);
  const flows = buildFlows(apiMap, dbMap);
  const errors = buildErrors(files, dbMap, publicTables);

  fs.mkdirSync(OUT, { recursive: true });

  const meta = {
    version: 1,
    last_scan: startedIso,
    files_scanned: files.length,
    roots: [...SCAN_GLOBS],
  };

  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  fs.writeFileSync(path.join(OUT, "repo-map.json"), JSON.stringify({ files }, null, 2), "utf8");
  fs.writeFileSync(path.join(OUT, "routes.json"), JSON.stringify({ routes }, null, 2), "utf8");
  fs.writeFileSync(path.join(OUT, "api-map.json"), JSON.stringify({ endpoints: apiMap }, null, 2), "utf8");
  fs.writeFileSync(path.join(OUT, "db-map.json"), JSON.stringify(dbMap, null, 2), "utf8");
  fs.writeFileSync(path.join(OUT, "flows.json"), JSON.stringify(flows, null, 2), "utf8");
  fs.writeFileSync(path.join(OUT, "dependencies.json"), JSON.stringify({ graph }, null, 2), "utf8");
  fs.writeFileSync(path.join(OUT, "errors.json"), JSON.stringify(errors, null, 2), "utf8");
}

export function runScanCli() {
  const started = new Date().toISOString();
  const files = scanAllFileEntries();
  writeRepoIntelligence(files, started);
  console.log(`[scanRepo] Wrote ${files.length} files to ${OUT}`);
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirect) {
  runScanCli();
}
