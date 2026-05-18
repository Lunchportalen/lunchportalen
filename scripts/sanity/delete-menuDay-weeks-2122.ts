import { createClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "node:path";

import { requireSanityProjectIdFromEnv } from "./sanityProjectEnv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const API_VERSION = "2024-01-01";

/** Feil-seedet uke 21–22 (2026); 15.05 (V5) skal IKKE slettes */
const BAD_DATES = [
  "2026-05-18",
  "2026-05-19",
  "2026-05-20",
  "2026-05-21",
  "2026-05-22",
  "2026-05-25",
  "2026-05-26",
  "2026-05-27",
  "2026-05-28",
  "2026-05-29",
] as const;

function safeEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  const tokenRaw =
    process.env.SANITY_WRITE_TOKEN ??
    process.env.SANITY_TOKEN ??
    process.env.SANITY_API_TOKEN;

  if (!tokenRaw || !tokenRaw.trim()) {
    console.error("FAIL: Sanity write-token mangler i env.");
    console.error(
      "Set SANITY_WRITE_TOKEN, SANITY_TOKEN eller SANITY_API_TOKEN. Eksempel:",
    );
    console.error('$env:SANITY_WRITE_TOKEN="<token>"; npm run sanity:delete-menuDay-weeks-2122');
    process.exit(1);
  }

  const token = tokenRaw.trim();

  const projectId = requireSanityProjectIdFromEnv();
  const dataset = safeEnv("NEXT_PUBLIC_SANITY_DATASET") || safeEnv("SANITY_DATASET") || "production";

  const client = createClient({
    projectId,
    dataset,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
  });

  const published = await client.fetch<string[]>(
    `*[_type == "menuDay" && date in $dates]._id`,
    { dates: [...BAD_DATES] },
  );
  const drafts = await client.fetch<string[]>(
    `*[_id in path("drafts.**") && _type == "menuDay" && date in $dates]._id`,
    { dates: [...BAD_DATES] },
  );

  const ids = [...new Set([...(published ?? []), ...(drafts ?? [])])].sort();

  console.log(`Sanity: ${projectId}/${dataset}`);
  console.log(`menuDay-kandidater (publisert + kladd) for datoer uke 21–22: ${ids.length}`);

  if (ids.length === 0) {
    console.log("Ingenting å slette. Avslutter.");
    process.exit(0);
  }

  if (isDryRun) {
    ids.slice(0, 20).forEach((id) => console.log(`  [dry-run] ville slettet: ${id}`));
    if (ids.length > 20) console.log(`  ... og ${ids.length - 20} til`);
    process.exit(0);
  }

  const tx = client.transaction();
  for (const id of ids) {
    tx.delete(id);
  }
  await tx.commit();

  console.log(`OK: ${ids.length} menuDay-dokumenter slettet.`);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
