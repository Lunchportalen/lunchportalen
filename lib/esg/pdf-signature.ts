// lib/esg/pdf-signature.ts
import { formatDateTimeNO } from "@/lib/date/format";
export type EsgSignature = {
  lockedAt?: string | null;
  lockHash?: string | null;     // sha256 hex
  lockVersion?: string | null;  // v1/v2...
};

function safeText(v: any) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function shortHash(h: string, keep = 10) {
  const s = safeText(h);
  if (!s) return "";
  if (s.length <= keep * 2) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

export function signatureLines(args: {
  productName?: string; // "Lunchportalen"
  signature: EsgSignature | undefined;
  generatedAtISO: string;
}) {
  const product = safeText(args.productName || "Lunchportalen");
  const sig = args.signature ?? {};

  const lines: string[] = [];
  lines.push(`${product} – ESG-signatur`);
  lines.push(`Generert: ${formatDateTimeNO(args.generatedAtISO)}`);

  if (!sig.lockedAt || !sig.lockHash) {
    lines.push("Status: Ikke låst (ingen SHA-256 hash)");
    return lines;
  }

  lines.push(`Låst: ${formatDateTimeNO(sig.lockedAt)}`);
  if (sig.lockVersion) lines.push(`Lock-versjon: ${safeText(sig.lockVersion)}`);

  // Vis kort hash i selve PDF-en (full hash kan evt. ligge i JSON/DB)
  lines.push(`SHA-256: ${shortHash(sig.lockHash, 12)}`);

  return lines;
}
