import { createClient } from "@sanity/client";
import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type SanityDoc = Record<string, unknown> & {
  _id?: string;
  _type?: string;
  _createdAt?: string;
  _updatedAt?: string;
  date?: string;
};

type DumpType =
  | "menuDay"
  | "weekPlan"
  | "mealIdea"
  | "menu"
  | "closedDate"
  | "announcement"
  | "dish"
  | "productPlan"
  | "weekTemplate";

type TypeConfig = {
  type: DumpType;
  fileName: string;
};

const API_VERSION = safeEnv("NEXT_PUBLIC_SANITY_API_VERSION") || "2024-01-01";
const PROJECT_ID =
  safeEnv("NEXT_PUBLIC_SANITY_PROJECT_ID") ||
  safeEnv("SANITY_PROJECT_ID") ||
  safeEnv("SANITY_STUDIO_PROJECT_ID") ||
  "f3vuhd2f";
const DATASET =
  safeEnv("NEXT_PUBLIC_SANITY_DATASET") ||
  safeEnv("SANITY_DATASET") ||
  safeEnv("SANITY_STUDIO_DATASET") ||
  "production";

const ROOT = process.cwd();
const DUMP_DIR = path.join(ROOT, "docs", "audit", "sanity-dump");
const REPORT_PATH = path.join(ROOT, "docs", "audit", "sanity-live-state.md");
const DRY_RUN = process.argv.includes("--dry-run");

const TYPES: TypeConfig[] = [
  { type: "menuDay", fileName: "menuDay.ndjson" },
  { type: "weekPlan", fileName: "weekPlan.ndjson" },
  { type: "mealIdea", fileName: "mealIdea.ndjson" },
  { type: "menu", fileName: "menu.ndjson" },
  { type: "closedDate", fileName: "closedDate.ndjson" },
  { type: "announcement", fileName: "announcement.ndjson" },
  { type: "dish", fileName: "dish.ndjson" },
  { type: "productPlan", fileName: "productPlan.ndjson" },
  { type: "weekTemplate", fileName: "weekTemplate.ndjson" },
];

const DECLARED_FIELDS: Record<string, Set<string>> = {
  menuDay: new Set([
    "date",
    "mealRef",
    "mealTitle",
    "description",
    "allergens",
    "mayContain",
    "nutritionPer100g",
    "kitchenStyle",
    "costTier",
    "estimatedCostPerPortion",
    "isFishDish",
    "isSoup",
    "isVegetarian",
    "approvedForPublish",
    "approvedAt",
    "customerVisible",
    "customerVisibleSetAt",
  ]),
  weekPlan: new Set([
    "weekKey",
    "weekStart",
    "status",
    "approvedForPublish",
    "customerVisible",
    "visibleFrom",
    "becomesCurrentAt",
    "publishedAt",
    "lockedAt",
    "locked",
    "days",
    "noteForKitchen",
  ]),
};

const SYSTEM_FIELDS = new Set(["_id", "_type", "_createdAt", "_updatedAt", "_rev", "_allKeys"]);

function safeEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function repoCommit(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "Ikke funnet";
  }
}

function publishedId(id: string): string {
  return id.startsWith("drafts.") ? id.slice("drafts.".length) : id;
}

function isDraft(doc: SanityDoc): boolean {
  return String(doc._id ?? "").startsWith("drafts.");
}

function byteSize(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function jsonLine(doc: SanityDoc): string {
  return `${JSON.stringify(doc)}\n`;
}

function docForAnalysis(doc: SanityDoc): SanityDoc {
  const allKeys = doc._allKeys;
  return allKeys && typeof allKeys === "object" && !Array.isArray(allKeys)
    ? (allKeys as SanityDoc)
    : doc;
}

function allTopLevelKeys(docs: SanityDoc[]): string[] {
  const keys = new Set<string>();
  for (const doc of docs) {
    for (const key of Object.keys(docForAnalysis(doc))) {
      keys.add(key);
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

function hasOwn(doc: SanityDoc, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(docForAnalysis(doc), key);
}

function valueOf(doc: SanityDoc, key: string): unknown {
  return docForAnalysis(doc)[key];
}

function isNonNull(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function sampleValue(value: unknown): string {
  if (typeof value === "string") return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  const json = JSON.stringify(value);
  if (!json) return String(value);
  return json.length > 120 ? `${json.slice(0, 117)}...` : json;
}

function fieldAnalysisTable(type: DumpType, docs: SanityDoc[]): string {
  if (!docs.length) return "Ingen dokumenter funnet.\n";

  const declared = DECLARED_FIELDS[type] ?? new Set<string>();
  const rows = [
    "| Felt | Antall dokumenter med feltet | Antall med non-null verdi | Eksempelverdi (første ikke-null) |",
    "|---|---:|---:|---|",
  ];

  for (const key of allTopLevelKeys(docs)) {
    const docsWithField = docs.filter((doc) => hasOwn(doc, key));
    const nonNullDocs = docsWithField.filter((doc) => isNonNull(valueOf(doc, key)));
    const sampleDoc = nonNullDocs.find((doc) => isNonNull(valueOf(doc, key)));
    const undeclared =
      SYSTEM_FIELDS.has(key) || declared.has(key) || !DECLARED_FIELDS[type] ? "" : " [UDEKLARERT]";
    rows.push(
      `| \`${key}\`${undeclared} | ${docsWithField.length} | ${nonNullDocs.length} | ${sampleDoc ? markdownEscape(sampleValue(valueOf(sampleDoc, key))) : ""} |`,
    );
  }

  return `${rows.join("\n")}\n`;
}

function markdownEscape(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function isoOrEmpty(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function minString(values: string[]): string {
  return values.length ? values.reduce((a, b) => (a < b ? a : b)) : "Ikke funnet";
}

function maxString(values: string[]): string {
  return values.length ? values.reduce((a, b) => (a > b ? a : b)) : "Ikke funnet";
}

function dateStats(docs: SanityDoc[], nowDate: string) {
  const dates = Array.from(
    new Set(
      docs
        .map((doc) => isoOrEmpty(docForAnalysis(doc).date).slice(0, 10))
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)),
    ),
  ).sort();

  return {
    oldest: dates[0] ?? "Ikke funnet",
    newest: dates[dates.length - 1] ?? "Ikke funnet",
    unique: dates.length,
    past: dates.filter((date) => date < nowDate).length,
    future: dates.filter((date) => date > nowDate).length,
    dates,
  };
}

function weekPlanDates(docs: SanityDoc[]): Set<string> {
  const dates = new Set<string>();
  for (const doc of docs) {
    const days = docForAnalysis(doc).days;
    if (!Array.isArray(days)) continue;
    for (const day of days) {
      if (!day || typeof day !== "object") continue;
      const date = isoOrEmpty((day as Record<string, unknown>).date).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.add(date);
    }
  }
  return dates;
}

function countStats(docs: SanityDoc[]) {
  const ids = new Set(docs.map((doc) => String(doc._id ?? "")).filter(Boolean));
  const drafts = docs.filter(isDraft);
  const published = docs.filter((doc) => !isDraft(doc));
  const draftOnly = drafts.filter((doc) => !ids.has(publishedId(String(doc._id ?? ""))));
  return { total: docs.length, drafts: drafts.length, published: published.length, draftOnly: draftOnly.length };
}

function timestampRow(type: DumpType, docs: SanityDoc[]): string {
  const created = docs.map((doc) => isoOrEmpty(doc._createdAt)).filter(Boolean);
  const updated = docs.map((doc) => isoOrEmpty(doc._updatedAt)).filter(Boolean);
  return `| ${type} | ${minString(created)} | ${maxString(created)} | ${minString(updated)} | ${maxString(updated)} |`;
}

function referenceIntegrity(menuDayDocs: SanityDoc[], weekPlanDocs: SanityDoc[], mealIdeaDocs: SanityDoc[]) {
  const mealIdeaIds = new Set(mealIdeaDocs.map((doc) => String(doc._id ?? "")).filter(Boolean));
  const menuDayRefs = menuDayDocs
    .map((doc) => docForAnalysis(doc).mealRef)
    .filter((ref): ref is Record<string, unknown> => !!ref && typeof ref === "object" && !Array.isArray(ref))
    .map((ref) => String(ref._ref ?? "").trim())
    .filter(Boolean);

  const weekPlanRefs: string[] = [];
  for (const doc of weekPlanDocs) {
    const days = docForAnalysis(doc).days;
    if (!Array.isArray(days)) continue;
    for (const day of days) {
      if (!day || typeof day !== "object") continue;
      const ref = (day as Record<string, unknown>).mealRef;
      if (!ref || typeof ref !== "object" || Array.isArray(ref)) continue;
      const id = String((ref as Record<string, unknown>)._ref ?? "").trim();
      if (id) weekPlanRefs.push(id);
    }
  }

  return {
    menuDay: {
      total: menuDayRefs.length,
      valid: menuDayRefs.filter((id) => mealIdeaIds.has(id)).length,
      missing: menuDayRefs.filter((id) => !mealIdeaIds.has(id)).length,
    },
    weekPlan: {
      total: weekPlanRefs.length,
      valid: weekPlanRefs.filter((id) => mealIdeaIds.has(id)).length,
      missing: weekPlanRefs.filter((id) => !mealIdeaIds.has(id)).length,
    },
  };
}

function draftOnlyRows(allDocs: SanityDoc[]): string {
  const ids = new Set(allDocs.map((doc) => String(doc._id ?? "")).filter(Boolean));
  const rows = [
    "| _id | _type | date | _updatedAt |",
    "|---|---|---|---|",
  ];

  const draftOnly = allDocs
    .filter(isDraft)
    .filter((doc) => !ids.has(publishedId(String(doc._id ?? ""))))
    .sort((a, b) => String(a._updatedAt ?? "").localeCompare(String(b._updatedAt ?? "")));

  for (const doc of draftOnly) {
    const data = docForAnalysis(doc);
    rows.push(
      `| \`${doc._id ?? ""}\` | ${doc._type ?? data._type ?? ""} | ${isoOrEmpty(data.date)} | ${doc._updatedAt ?? data._updatedAt ?? ""} |`,
    );
  }

  if (rows.length === 2) rows.push("| Ikke funnet |  |  |  |");
  return `${rows.join("\n")}\n`;
}

function buildReport(dumps: Record<DumpType, SanityDoc[]>, dumpedAt: string): string {
  const nowDate = dumpedAt.slice(0, 10);
  const allDocs = Object.values(dumps).flat();
  const menuDayDates = dateStats(dumps.menuDay, nowDate);
  const weekDates = weekPlanDates(dumps.weekPlan);
  const refs = referenceIntegrity(dumps.menuDay, dumps.weekPlan, dumps.mealIdea);
  const modelUpdates = ["menuDay", "weekPlan"] as DumpType[];
  const latestUpdates = modelUpdates
    .map((type) => ({ type, value: maxString(dumps[type].map((doc) => isoOrEmpty(doc._updatedAt)).filter(Boolean)) }))
    .filter((row) => row.value !== "Ikke funnet")
    .sort((a, b) => b.value.localeCompare(a.value));

  const overlapDates = Array.from(new Set([...menuDayDates.dates, ...weekDates])).sort();
  const overlapRows = [
    "| Dato | menuDay? | weekPlan (via days[].date)? |",
    "|---|---|---|",
  ];
  for (const date of overlapDates) {
    const present = [menuDayDates.dates.includes(date), weekDates.has(date)];
    if (present.filter(Boolean).length < 2) continue;
    overlapRows.push(`| ${date} | ${present[0] ? "ja" : "nei"} | ${present[1] ? "ja" : "nei"} |`);
  }
  if (overlapRows.length === 2) overlapRows.push("| Ikke funnet | nei | nei |");

  const countRows = TYPES.map(({ type }) => {
    const stats = countStats(dumps[type]);
    return `| ${type} | ${stats.total} | ${stats.drafts} | ${stats.published} | ${stats.draftOnly} |`;
  });

  return `# Lunchportalen — live-state i Sanity

**Dato for dump:** ${dumpedAt}  
**Repo-commit:** ${repoCommit()}  
**Sanity projectId:** ${PROJECT_ID}  
**Sanity dataset:** ${DATASET}  
**Sanity API-versjon brukt:** ${API_VERSION}

---

## 1. Dokumentantall per type

| Type | Antall dokumenter | Antall drafts | Antall published | Antall som er bare draft (ikke publisert) |
|---|---:|---:|---:|---:|
${countRows.join("\n")}

Forklaring: "Bare draft" betyr et dokument der \`_id\` starter med \`drafts.\` og det IKKE finnes et tilsvarende dokument uten \`drafts.\`-prefix.

## 2. menuDay — felt-analyse

${fieldAnalysisTable("menuDay", dumps.menuDay)}
## 3. weekPlan — felt-analyse

${fieldAnalysisTable("weekPlan", dumps.weekPlan)}
Nyeste \`weekPlan._updatedAt\`: ${maxString(dumps.weekPlan.map((doc) => isoOrEmpty(doc._updatedAt)).filter(Boolean))}

## 4. Tidsstempel-analyse — hvilken modell er aktiv?

| Modell | Eldste \`_createdAt\` | Nyeste \`_createdAt\` | Eldste \`_updatedAt\` | Nyeste \`_updatedAt\` |
|---|---|---|---|---|
${timestampRow("menuDay", dumps.menuDay)}
${timestampRow("weekPlan", dumps.weekPlan)}

Tolkning: siste aktivitet etter \`_updatedAt\` er ${latestUpdates[0] ? `\`${latestUpdates[0].type}\` (${latestUpdates[0].value})` : "Ikke funnet"}. Full rekkefølge etter nyeste \`_updatedAt\`: ${latestUpdates.length ? latestUpdates.map((row) => `\`${row.type}\` ${row.value}`).join(", ") : "Ikke funnet"}. Dette er tallgrunnlag, ikke en beslutning om kanon.

## 5. Dato-spenn — hvilke uker er dekket?

| Modell | Eldste \`date\` | Nyeste \`date\` | Antall unike datoer | Fortid | Fremtid |
|---|---|---|---:|---:|---:|
| menuDay | ${menuDayDates.oldest} | ${menuDayDates.newest} | ${menuDayDates.unique} | ${menuDayDates.past} | ${menuDayDates.future} |

## 6. Krysskobling — finnes samme dato i flere modeller?

${overlapRows.join("\n")}

## 7. Referanseintegritet

| Modell | Referanser til mealIdea | Referanser som finnes | Referanser som mangler |
|---|---:|---:|---:|
| menuDay.mealRef | ${refs.menuDay.total} | ${refs.menuDay.valid} | ${refs.menuDay.missing} |
| weekPlan.days[].mealRef | ${refs.weekPlan.total} | ${refs.weekPlan.valid} | ${refs.weekPlan.missing} |

## 8. Drafts som ikke er publisert

${draftOnlyRows(allDocs)}
## 9. Sammendrag

- \`menuDay\`: ${dumps.menuDay.length} dokumenter i dumpen.
- \`weekPlan\`: ${dumps.weekPlan.length} dokumenter i dumpen.
- \`mealIdea\`: ${dumps.mealIdea.length} dokumenter i dumpen.
- Nyeste aktivitet blant \`menuDay\` og \`weekPlan\`: ${latestUpdates[0] ? `\`${latestUpdates[0].type}\` (${latestUpdates[0].value})` : "Ikke funnet"}.
- Dato-overlapp på tvers av modellene: ${Math.max(0, overlapRows.length - 2)} datoer.
- Drafts uten published motpart: ${allDocs.filter(isDraft).filter((doc) => !new Set(allDocs.map((item) => String(item._id ?? ""))).has(publishedId(String(doc._id ?? "")))).length}.
`;
}

function missingTokenReport(dumpedAt: string): string {
  return `# Lunchportalen — live-state i Sanity

**Dato for dump:** ${dumpedAt}  
**Repo-commit:** ${repoCommit()}  
**Sanity projectId:** ${PROJECT_ID}  
**Sanity dataset:** ${DATASET}  
**Sanity API-versjon brukt:** ${API_VERSION}

---

Dump kunne ikke kjøres. SANITY_TOKEN mangler i env. Bruker må kjøre lokalt.

Kjør:

\`\`\`bash
SANITY_TOKEN=sk_... npm run sanity:dump-menu-state
\`\`\`

eller:

\`\`\`bash
SANITY_TOKEN=sk_... npx tsx scripts/sanity/dump-menu-state.ts
\`\`\`

Ingen NDJSON-filer ble generert i denne kjøringen.
`;
}

async function main() {
  const dumpedAt = new Date().toISOString();
  const token = safeEnv("SANITY_TOKEN");

  if (!token) {
    const report = missingTokenReport(dumpedAt);
    if (DRY_RUN) {
      console.log("[dry-run] SANITY_TOKEN mangler. Ville skrevet docs/audit/sanity-live-state.md.");
      console.log(report);
      return;
    }
    await writeFile(REPORT_PATH, report, "utf8");
    console.log("Dump kunne ikke kjøres. SANITY_TOKEN mangler i env. Rapport skrevet til docs/audit/sanity-live-state.md.");
    return;
  }

  const client = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
    perspective: "raw",
  });

  const dumps = Object.fromEntries(TYPES.map(({ type }) => [type, []])) as Record<DumpType, SanityDoc[]>;

  if (!DRY_RUN) {
    await mkdir(DUMP_DIR, { recursive: true });
  }

  for (const { type, fileName } of TYPES) {
    const query = `*[_type == $type]{ ..., "_allKeys": *[_id == ^._id][0] }`;
    try {
      const docs = await client.fetch<SanityDoc[]>(query, { type });
      const safeDocs = Array.isArray(docs) ? docs : [];
      dumps[type] = safeDocs;
      const ndjson = safeDocs.map(jsonLine).join("");
      const filePath = path.join(DUMP_DIR, fileName);
      if (!DRY_RUN) {
        await writeFile(filePath, ndjson, "utf8");
      }
      console.log(`${DRY_RUN ? "[dry-run] " : ""}Dumping ${type}... ${safeDocs.length} documents (${formatBytes(byteSize(ndjson))})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dumps[type] = [];
      console.error(`Dumping ${type} failed: ${message}`);
      if (!DRY_RUN) {
        await writeFile(path.join(DUMP_DIR, fileName), "", "utf8");
      }
    }
  }

  const report = buildReport(dumps, dumpedAt);
  if (DRY_RUN) {
    console.log(`[dry-run] Would write ${REPORT_PATH} (${formatBytes(byteSize(report))})`);
    return;
  }
  await writeFile(REPORT_PATH, report, "utf8");
  console.log(`Rapport skrevet til docs/audit/sanity-live-state.md (${formatBytes(byteSize(report))})`);
}

main().catch((error) => {
  console.error("sanity_dump_menu_state_failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
