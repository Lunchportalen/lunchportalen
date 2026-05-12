import { createClient } from "@sanity/client";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";

const isDryRun = process.argv.includes("--dry-run");

const token = process.env.SANITY_TOKEN;
if (!token) {
  console.error("FAIL: SANITY_TOKEN mangler i env.");
  console.error('Kjør: $env:SANITY_TOKEN="<token>"; npm run sanity:delete-menuContent');
  process.exit(1);
}

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "4udoq5d8";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2024-01-01",
  token,
  useCdn: false,
});

const BACKUP_PATH = "docs/audit/sanity-dump/menuContent.ndjson";
const LOG_PATH = "docs/audit/sanity-delete-log.md";

async function main() {
  const liveCount = await client.fetch<number>('count(*[_type == "menuContent"])');
  console.log(`Live menuContent-dokumenter i Sanity: ${liveCount}`);

  if (!existsSync(BACKUP_PATH)) {
    console.error(`FAIL: Backup-fil ${BACKUP_PATH} mangler.`);
    process.exit(1);
  }

  const backupLines = readFileSync(BACKUP_PATH, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  console.log(`Backup-fil inneholder: ${backupLines.length} dokumenter`);

  if (liveCount !== backupLines.length) {
    console.error(`FAIL: Mismatch. Live=${liveCount}, backup=${backupLines.length}.`);
    console.error("Kjør fersk dump først: npm run sanity:dump-menu-state");
    process.exit(1);
  }

  const docs = await client.fetch<Array<{ _id: string; date?: string }>>('*[_type == "menuContent"]{_id, date}');

  if (docs.length === 0) {
    console.log("Ingen dokumenter å slette. Avslutter.");
    process.exit(0);
  }

  console.log("\nDokumenter som vil bli slettet:");
  docs.forEach((doc) => console.log(`  ${doc._id} (date: ${doc.date ?? "n/a"})`));

  if (isDryRun) {
    console.log("\n--dry-run: ingen sletting utført.");
    process.exit(0);
  }

  console.log("\nSletter...");
  const tx = client.transaction();
  for (const doc of docs) {
    tx.delete(doc._id);
  }
  await tx.commit();
  console.log(`OK: ${docs.length} dokumenter slettet.`);

  const operator = process.env.USER ?? userInfo().username ?? "unknown";
  const timestamp = new Date().toISOString();
  const logContent = [
    "# Sanity sletting — menuContent",
    "",
    `**Tidspunkt:** ${timestamp}`,
    `**Operator:** ${operator}`,
    `**Antall slettet:** ${docs.length}`,
    `**Backup:** ${BACKUP_PATH}`,
    "",
    "## Slettede dokumenter",
    "",
    ...docs.map((doc) => `- ${doc._id} (date: ${doc.date ?? "n/a"})`),
    "",
  ].join("\n");
  writeFileSync(LOG_PATH, logContent, { encoding: "utf-8" });
  console.log(`Logg skrevet til ${LOG_PATH}`);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
