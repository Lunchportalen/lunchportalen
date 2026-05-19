/**
 * Seed environment loader + Variant C / staging-ref guards (fail-closed).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const STAGING_REF = "uigxsboqeruxflgzqztl";
export const PROD_REF = "hkpokyapzarefrgqzkos";
export const STAGING_EMAIL_DOMAIN = "@staging.lunchportalen.test";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, "..", "..", "..");

export type SeedCliArgs = {
  target: string;
  confirm: boolean;
};

export type SeedEnv = {
  supabaseUrl: string;
  serviceRoleKey: string;
  postgresUrlNonPooling: string;
  databaseUrl: string;
};

function parseDotEnv(content: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

export function parseSeedCliArgs(argv: string[]): SeedCliArgs {
  const targetIdx = argv.indexOf("--target");
  const target =
    targetIdx >= 0 && argv[targetIdx + 1] ? String(argv[targetIdx + 1]) : "";
  const confirm = argv.includes("--confirm");
  return { target, confirm };
}

function assertNoProdRef(label: string, value: string): void {
  if (value.includes(PROD_REF)) {
    throw new Error(`REFUSE_PROD_REF in ${label}`);
  }
}

function assertStagingRef(label: string, value: string): void {
  if (!value.includes(STAGING_REF)) {
    throw new Error(`REFUSE_MISSING_STAGING_REF in ${label}`);
  }
}

function loadEnvFile(): Record<string, string> {
  const explicit = process.env.SEED_ENV_FILE?.trim();
  const defaultPath = join(REPO_ROOT, "scripts", "audit", "staging-env-actual-2026-05-20.env");
  const path = explicit ? resolve(REPO_ROOT, explicit) : defaultPath;

  if (!existsSync(path)) {
    throw new Error(`SEED_ENV_FILE_MISSING path=${path.replace(REPO_ROOT, "<repo>")}`);
  }

  return parseDotEnv(readFileSync(path, "utf8"));
}

/**
 * Load and validate seed environment. Requires `--target staging`.
 */
export function loadSeedEnv(argv: string[]): SeedEnv {
  const cli = parseSeedCliArgs(argv);
  if (cli.target !== "staging") {
    throw new Error('REQUIRE_CLI_ARG --target staging (refusing to run without explicit staging target)');
  }

  const fileEnv = loadEnvFile();

  const supabaseUrl = (
    fileEnv.SUPABASE_URL ??
    fileEnv.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).trim();
  const serviceRoleKey = (fileEnv.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const postgresUrlNonPooling = (fileEnv.POSTGRES_URL_NON_POOLING ?? "").trim();
  const databaseUrl = (fileEnv.DATABASE_URL ?? fileEnv.POSTGRES_URL ?? "").trim();

  if (!supabaseUrl) throw new Error("MISSING_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("MISSING_SUPABASE_SERVICE_ROLE_KEY");
  if (!postgresUrlNonPooling) throw new Error("MISSING_POSTGRES_URL_NON_POOLING");
  if (!databaseUrl) throw new Error("MISSING_DATABASE_URL");

  assertNoProdRef("SUPABASE_URL", supabaseUrl);
  assertStagingRef("SUPABASE_URL", supabaseUrl);

  assertNoProdRef("POSTGRES_URL_NON_POOLING", postgresUrlNonPooling);
  assertStagingRef("POSTGRES_URL_NON_POOLING", postgresUrlNonPooling);

  assertNoProdRef("DATABASE_URL", databaseUrl);
  assertStagingRef("DATABASE_URL", databaseUrl);

  if (serviceRoleKey.length < 100) {
    throw new Error(`REFUSE_SERVICE_ROLE_KEY_TOO_SHORT length=${serviceRoleKey.length}`);
  }
  assertNoProdRef("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);

  process.env.SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  process.env.POSTGRES_URL_NON_POOLING = postgresUrlNonPooling;
  process.env.DATABASE_URL = databaseUrl;

  return {
    supabaseUrl,
    serviceRoleKey,
    postgresUrlNonPooling,
    databaseUrl,
  };
}

export function assertStagingEmail(email: string): void {
  const normalized = email.trim().toLowerCase();
  if (!normalized.endsWith(STAGING_EMAIL_DOMAIN)) {
    throw new Error(`REFUSE_NON_STAGING_EMAIL domain=${STAGING_EMAIL_DOMAIN}`);
  }
}
