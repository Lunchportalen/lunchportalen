/**
 * Finn første mandag i et intervall der både BASIS og LUXUS mangler
 * complete varmrett-uke (< 5 menuDay per tier, Man–Fre).
 *
 * npm run sanity:find-empty-week
 */
import { createClient, type SanityClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "node:path";

import { mondayToFridayIso } from "@/lib/menu-publish/calendar";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const API_VERSION = "2024-01-01";
const CATEGORY = "varmrett";

const FIRST_MONDAY = "2026-06-08";
const LAST_MONDAY = "2026-08-31";

function requireEnv(name: string): string {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`Mangler env: ${name}`);
  return v;
}

function buildSanityRead(): SanityClient {
  const projectId = requireEnv("NEXT_PUBLIC_SANITY_PROJECT_ID");
  const dataset = requireEnv("NEXT_PUBLIC_SANITY_DATASET");
  const apiVersion =
    String(process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "").trim() || API_VERSION;
  const token = String(
    process.env.SANITY_READ_TOKEN ??
      process.env.SANITY_WRITE_TOKEN ??
      process.env.SANITY_TOKEN ??
      process.env.SANITY_API_TOKEN ??
      "",
  ).trim();
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token: token || undefined,
  });
}

function parseIso(d: string): { y: number; m: number; day: number } {
  const [y, m, day] = d.split("-").map((x) => Number.parseInt(x, 10));
  return { y, m, day };
}

function toIso(y: number, m: number, day: number): string {
  return `${String(y)}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Mandager fra firstMonday til lastMonday (inkl.), steg 7 dager. */
function mondaysInRange(firstMonday: string, lastMonday: string): string[] {
  const out: string[] = [];
  let cur = firstMonday;
  const end = lastMonday;
  while (cur <= end) {
    out.push(cur);
    const { y, m, day } = parseIso(cur);
    const dt = new Date(Date.UTC(y, m - 1, day + 7));
    cur = toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  return out;
}

const countGroq = `count(*[
  _type == "menuDay" &&
  planTier == $planTier &&
  category == $category &&
  date in $dates &&
  !(_id in path("drafts.**"))
])`;

async function countTier(
  client: SanityClient,
  dates: string[],
  planTier: "BASIS" | "LUXUS",
): Promise<number> {
  const n = await client.fetch<number>(countGroq, {
    planTier,
    category: CATEGORY,
    dates,
  });
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

const client = buildSanityRead();
const weeks = mondaysInRange(FIRST_MONDAY, LAST_MONDAY);

console.log("[find-empty-week] Mandager:", weeks.join(", "));
console.log("[find-empty-week] dataset:", requireEnv("NEXT_PUBLIC_SANITY_DATASET"));
console.log("");

let picked: { monday: string; basis: number; luxus: number } | null = null;

for (const monday of weeks) {
  const dates = mondayToFridayIso(monday);
  const basis = await countTier(client, dates, "BASIS");
  const luxus = await countTier(client, dates, "LUXUS");
  console.log(`  ${monday}: BASIS=${basis}/5, LUXUS=${luxus}/5`);
  if (basis < 5 && luxus < 5 && !picked) {
    picked = { monday, basis, luxus };
  }
}

console.log("");

if (picked) {
  console.log(
    "[find-empty-week] Første uke der både BASIS og LUXUS har < 5 varmrett-dager:",
    `${picked.monday} (BASIS ${picked.basis}, LUXUS ${picked.luxus})`,
  );
} else {
  console.log(
    "[find-empty-week] Ingen mandag i intervallet der begge tier er < 5 — sjekk manuelt eller utvid intervall.",
  );
  process.exitCode = 2;
}
