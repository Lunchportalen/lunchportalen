import { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { getNorwayDocument, NORWAY_LEGAL_STATUS } from "@/lib/legal/norwayDocuments";
import type { LegalDocumentType } from "@/lib/legal/legalDocumentRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  const rid = makeRid();
  const { type } = await ctx.params;
  const doc = getNorwayDocument(type as LegalDocumentType);
  if (!doc) return jsonErr(rid, "Dokument finnes ikke.", 404, "NOT_FOUND");
  return jsonOk(rid, {
    norwayLegalStatus: NORWAY_LEGAL_STATUS,
    document: {
      documentType: doc.documentType,
      version: doc.version,
      checksum: doc.checksum,
      effectiveDate: doc.effectiveDate,
      title: doc.title,
      body: doc.body,
      locale: doc.locale,
      countryCode: doc.countryCode,
    },
  });
}
