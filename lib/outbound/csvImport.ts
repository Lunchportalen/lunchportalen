/**
 * Manuell CSV-import (ingen scraping). Forventet header-rad; kolonner fleksible.
 */

import { createOutboundLead, type OutboundLead } from "@/lib/outbound/lead";

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

const ALIASES: Record<string, keyof Omit<OutboundLead, "id">> = {
  companyname: "companyName",
  company: "companyName",
  firma: "companyName",
  bedrift: "companyName",
  industry: "industry",
  bransje: "industry",
  role: "role",
  rolle: "role",
  title: "role",
  contactname: "contactName",
  name: "contactName",
  kontakt: "contactName",
  email: "email",
  epost: "email",
  mail: "email",
  linkedinurl: "linkedinUrl",
  linkedin: "linkedinUrl",
  url: "linkedinUrl",
  companysize: "companySize",
  size: "companySize",
  ansatte: "companySize",
};

function mapRow(headers: string[], cells: string[]): Partial<OutboundLead> | null {
  const row: Record<string, string> = {};
  headers.forEach((h, i) => {
    row[h] = cells[i] ?? "";
  });

  const o: Partial<OutboundLead> = {};
  for (const [rawKey, val] of Object.entries(row)) {
    const nk = normHeader(rawKey);
    const field = ALIASES[nk];
    if (!field) continue;
    if (field === "companySize") {
      const n = parseInt(String(val).replace(/\D/g, ""), 10);
      if (Number.isFinite(n)) (o as OutboundLead).companySize = n;
    } else {
      (o as Record<string, string>)[field] = val.trim();
    }
  }

  if (!o.companyName) return null;
  return o;
}

export type CsvImportResult = {
  leads: OutboundLead[];
  errors: string[];
};

export function parseOutboundCsv(text: string): CsvImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  const leads: OutboundLead[] = [];

  if (lines.length < 2) {
    return { leads: [], errors: ["CSV må ha header + minst én rad."] };
  }

  const headers = splitCsvLine(lines[0]!).map(normHeader);

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    try {
      const partial = mapRow(headers, cells);
      if (!partial) {
        errors.push(`Rad ${i + 1}: mangler companyName/firma.`);
        continue;
      }
      leads.push(
        createOutboundLead({
          companyName: partial.companyName ?? "",
          industry: partial.industry ?? "office",
          role: partial.role ?? "office",
          contactName: partial.contactName,
          email: partial.email,
          linkedinUrl: partial.linkedinUrl,
          companySize: partial.companySize,
        }),
      );
    } catch (e) {
      errors.push(`Rad ${i + 1}: ${e instanceof Error ? e.message : "ukjent feil"}`);
    }
  }

  return { leads, errors };
}
