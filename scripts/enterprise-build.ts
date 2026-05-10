import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MARKER = "// @enterprise-exclude";
const ROUTE_FILE = "route.ts";
const EXCLUDED_FILE = ".route.ts.excluded";

type ExcludedRoute = {
  routePath: string;
  hiddenPath: string;
};

let activeHiddenRoutes: ExcludedRoute[] = [];
let restoring = false;

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      await walk(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name === ROUTE_FILE) {
      out.push(fullPath);
    }
  }

  return out;
}

function hasEnterpriseExcludeMarker(source: string) {
  return source
    .split(/\r?\n/)
    .slice(0, 5)
    .some((line) => line.trim() === MARKER);
}

async function findEnterpriseExcludedRoutes() {
  const apiDir = path.join(ROOT, "app", "api");
  const routeFiles = await walk(apiDir);
  const excluded: ExcludedRoute[] = [];

  for (const routePath of routeFiles) {
    const source = await fs.readFile(routePath, "utf8");
    if (!hasEnterpriseExcludeMarker(source)) continue;
    excluded.push({
      routePath,
      hiddenPath: path.join(path.dirname(routePath), EXCLUDED_FILE),
    });
  }

  return excluded.sort((a, b) => a.routePath.localeCompare(b.routePath));
}

async function hideRoutes(routes: ExcludedRoute[]) {
  const hidden: ExcludedRoute[] = [];

  for (const route of routes) {
    if (await exists(route.hiddenPath)) {
      throw new Error(`Enterprise exclude target already exists: ${path.relative(ROOT, route.hiddenPath)}`);
    }
    await fs.rename(route.routePath, route.hiddenPath);
    hidden.push(route);
  }

  return hidden;
}

async function restoreRoutes(routes: ExcludedRoute[]) {
  if (restoring) return;
  restoring = true;
  const errors: string[] = [];

  try {
    for (const route of [...routes].reverse()) {
      try {
        if (!(await exists(route.hiddenPath))) continue;
        await fs.rename(route.hiddenPath, route.routePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${path.relative(ROOT, route.routePath)}: ${message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Could not restore enterprise-excluded routes:\n${errors.join("\n")}`);
    }
  } finally {
    activeHiddenRoutes = [];
    restoring = false;
  }
}

async function restoreAndExit(exitCode: number) {
  try {
    await restoreRoutes(activeHiddenRoutes);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  process.exit(exitCode);
}

process.once("SIGINT", () => {
  void restoreAndExit(130);
});

process.once("SIGTERM", () => {
  void restoreAndExit(143);
});

function runNextBuild() {
  return new Promise<number>((resolve, reject) => {
    const child = spawn("next", ["build"], {
      cwd: ROOT,
      env: process.env,
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`next build exited by signal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function main() {
  const routes = await findEnterpriseExcludedRoutes();
  let hidden: ExcludedRoute[] = [];
  let buildExitCode = 1;

  console.log(`[enterprise-build] Excluding ${routes.length} route file(s) from next build.`);

  try {
    hidden = await hideRoutes(routes);
    activeHiddenRoutes = hidden;
    buildExitCode = await runNextBuild();
  } finally {
    await restoreRoutes(hidden);
    console.log(`[enterprise-build] Restored ${hidden.length} route file(s).`);
  }

  process.exit(buildExitCode);
}

main().catch(async (error) => {
  console.error("[enterprise-build] FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
