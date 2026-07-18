import { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  NORWAY_LEGAL_STATUS,
  NORWAY_REQUIRED_DOCS_BY_ROLE,
  requiredNorwayDocumentsForRole,
  type NorwaySubjectRole,
} from "@/lib/legal/norwayDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asRole(v: string | null): NorwaySubjectRole | null {
  if (v === "provider" || v === "company" || v === "employee") return v;
  return null;
}

export async function GET(req: NextRequest) {
  const rid = makeRid();
  const role = asRole(req.nextUrl.searchParams.get("role"));
  if (!role) return jsonErr(rid, "Ugyldig rolle.", 400, "VALIDATION");
  const docs = requiredNorwayDocumentsForRole(role).map((d) => ({
    documentType: d.documentType,
    version: d.version,
    checksum: d.checksum,
    effectiveDate: d.effectiveDate,
    title: d.title,
    norwayLegalStatus: d.norwayLegalStatus,
    href: `/api/legal/norway/documents/${d.documentType}`,
  }));
  return jsonOk(rid, {
    norwayLegalStatus: NORWAY_LEGAL_STATUS,
    role,
    required: [...NORWAY_REQUIRED_DOCS_BY_ROLE[role]],
    documents: docs,
  });
}
