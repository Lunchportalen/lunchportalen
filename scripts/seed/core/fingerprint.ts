/**
 * Deterministic dataset fingerprints for seed verification (HV-safe aggregates).
 */
import { createHash } from "node:crypto";

export function hashSortedStrings(values: string[]): string {
  const sorted = values.map((v) => v.trim().toLowerCase()).sort();
  return createHash("md5").update(sorted.join("|")).digest("hex");
}

export type SeedFingerprint = {
  emails_hash: string;
  first10_emails_hash: string;
  company_names_hash: string;
  location_names_hash: string;
  email_count: number;
};

export function buildSeedFingerprint(input: {
  emails: string[];
  /** F1 hello users (global index 0-9), not alphabetical slice. */
  first10Emails: string[];
  companyNames: string[];
  locationNames: string[];
}): SeedFingerprint {
  const emails = input.emails.map((e) => e.toLowerCase());
  const first10 = input.first10Emails.map((e) => e.toLowerCase());
  return {
    emails_hash: hashSortedStrings(emails),
    first10_emails_hash: hashSortedStrings(first10),
    company_names_hash: hashSortedStrings(input.companyNames),
    location_names_hash: hashSortedStrings(input.locationNames),
    email_count: emails.length,
  };
}
