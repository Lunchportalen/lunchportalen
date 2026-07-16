/**
 * Human-readable country pack summaries for external reviewers (15G.3A).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { auditAllCountries } from "../../lib/review/phase15g3aCompleteness";
import { buildCountryCredentialChecklist } from "../../lib/review/credentialChecklist";
import { inventoryOfficialSourcesForCountry } from "../../lib/review/officialSourceInventory";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../docs/rc/evidence/phase15g3a/human");
mkdirSync(outDir, { recursive: true });

const audit = auditAllCountries();
for (const c of audit.countries) {
  const creds = buildCountryCredentialChecklist(c.countryCode);
  const sources = inventoryOfficialSourcesForCountry(c.countryCode);
  const md = `# Country pack ${c.countryCode} — reviewer-ready (NOT APPROVED)

- Release SHA: \`${c.releaseSha}\`
- Migration head: \`${c.migrationHead}\`
- Pack complete: **${c.packComplete ? "YES" : "NO"}**
- Reviewer status: **${c.reviewerStatus}**
- Evidence checksum: \`${c.evidenceChecksum}\`

## Approvals (honest)

- Tax: ${c.approvals.tax}
- Legal: ${c.approvals.legal}
- Invoice: ${c.approvals.invoice}
- E-invoice: ${c.approvals.eInvoice}
- Privacy: ${c.approvals.privacy}
- Localization: ${c.approvals.localization}

## Locales

${c.locales.map((l) => `- ${l}`).join("\n") || "- (none)"}

## Official sources (REVIEW_REQUIRED)

${sources.map((s) => `- [${s.claimKey}] ${s.authorityName}: ${s.sourceUrl} (\`${s.sourceChecksum.slice(0, 12)}…\`)`).join("\n") || "- none"}

## Unresolved critical questions

${c.unresolvedCriticalQuestions.map((q) => `- ${q}`).join("\n") || "- none listed"}

## Missing mandatory fields (action items)

| Field | Severity | Owner | Blocking credential | Completion evidence |
|---|---|---|---|---|
${c.missingMandatoryFields
  .map(
    (g) =>
      `| ${g.field} | ${g.severity} | ${g.ownerRole} | ${g.blockingCredential ?? "—"} | ${g.completionEvidence} |`,
  )
  .join("\n")}

## Credentials

${creds.items.map((i) => `- **${i.status}** — ${i.label} (${i.key})`).join("\n")}

---

Cursor/AI must not mark this pack APPROVED. External signed review required.
`;
  writeFileSync(join(outDir, `${c.countryCode}.md`), md, "utf8");
}
console.log(`Wrote ${audit.countries.length} human packs → ${outDir}`);
