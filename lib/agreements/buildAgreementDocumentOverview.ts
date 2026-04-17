/**
 * Canonical read-model for superadmin agreement-related documents.
 * Sources: company_terms_acceptance (DB), agreement_json.terms.pdfPath (operativ JSON).
 */

export type AgreementDocumentOverview = {
  source: "terms_acceptance" | "agreement_pdf";
  record_id: string | null;
  title: string;
  document_type: string;
  created_at: string | null;
  storage_path: string | null;
  company_id: string;
  company_agreement_id: string | null;
  legacy_agreement_id: string | null;
  version: string | null;
  credit_check_system: string | null;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeAgreementStoragePath(p: string): boolean {
  if (!p) return false;
  if (p.startsWith("/") || p.toLowerCase().startsWith("http")) return false;
  if (p.includes("..")) return false;
  return true;
}

function parseTs(iso: string | null): number {
  if (!iso) return 0;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
}

export function buildAgreementDocumentOverview(input: {
  companyId: string;
  agreementJson: unknown;
  termsAcceptanceRows: Array<Record<string, unknown>>;
  companyAgreementId: string | null;
  legacyAgreementId: string | null;
}): AgreementDocumentOverview[] {
  const companyId = safeStr(input.companyId);
  if (!companyId) return [];

  const rows: AgreementDocumentOverview[] = [];
  const aj = input.agreementJson;
  const termsJson =
    aj && typeof aj === "object" && (aj as Record<string, unknown>).terms && typeof (aj as Record<string, unknown>).terms === "object"
      ? ((aj as Record<string, unknown>).terms as Record<string, unknown>)
      : null;

  const pdfRaw = termsJson ? safeStr(termsJson.pdfPath || termsJson.pdf_path).slice(0, 500) : "";
  if (pdfRaw && safeAgreementStoragePath(pdfRaw)) {
    const createdAt =
      safeStr(termsJson.pdfUploadedAt || termsJson.pdf_generated_at || termsJson.accepted_at || termsJson.acceptedAt) || null;
    rows.push({
      source: "agreement_pdf",
      record_id: "agreement_pdf",
      title: "Avtale-PDF (lagring)",
      document_type: "pdf",
      created_at: createdAt,
      storage_path: pdfRaw,
      company_id: companyId,
      company_agreement_id: input.companyAgreementId,
      legacy_agreement_id: input.legacyAgreementId,
      version: termsJson.version != null ? safeStr(termsJson.version) : null,
      credit_check_system: null,
    });
  }

  const list = Array.isArray(input.termsAcceptanceRows) ? input.termsAcceptanceRows : [];
  for (const row of list) {
    const id = row?.id != null ? safeStr(row.id) : null;
    const version = row?.version != null ? safeStr(row.version) : null;
    const acceptedAt = row?.accepted_at != null ? safeStr(row.accepted_at) : null;
    rows.push({
      source: "terms_acceptance",
      record_id: id || null,
      title: version ? `Vilkår akseptert (versjon ${version})` : "Vilkår akseptert",
      document_type: "terms_acceptance",
      created_at: acceptedAt,
      storage_path: null,
      company_id: companyId,
      company_agreement_id: input.companyAgreementId,
      legacy_agreement_id: input.legacyAgreementId,
      version: version || null,
      credit_check_system: row?.credit_check_system != null ? safeStr(row.credit_check_system) : null,
    });
  }

  rows.sort((a, b) => {
    const da = parseTs(a.created_at);
    const db = parseTs(b.created_at);
    if (db !== da) return db - da;
    return `${a.source}:${a.record_id ?? ""}`.localeCompare(`${b.source}:${b.record_id ?? ""}`);
  });

  return rows;
}
