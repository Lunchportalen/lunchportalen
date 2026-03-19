/**
 * Body envelope contract for DB/API: documentType + fields + blocksBody.
 * Used when persisting pages with a document type wrapper.
 */

export function parseBodyEnvelope(body: unknown): {
  documentType: string | null;
  fields: Record<string, unknown>;
  blocksBody: string | unknown;
} {
  if (body != null && typeof body === "object" && "documentType" in body) {
    const b = body as Record<string, unknown>;
    const blocksBody = b.blocksBody;
    return {
      documentType: (b.documentType as string) ?? null,
      fields: (b.fields as Record<string, unknown>) ?? {},
      blocksBody: blocksBody !== undefined && blocksBody !== null ? blocksBody : "",
    };
  }
  if (body != null && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.blocks)) {
      return { documentType: null, fields: {}, blocksBody: body };
    }
  }
  if (typeof body === "string") {
    return { documentType: null, fields: {}, blocksBody: body };
  }
  return { documentType: null, fields: {}, blocksBody: "" };
}

export function serializeBodyEnvelope(x: {
  documentType: string | null;
  fields: Record<string, unknown>;
  blocksBody: unknown;
}): unknown {
  const documentType =
    typeof x.documentType === "string" && x.documentType.trim() !== "" ? x.documentType.trim() : null;
  const fields = x.fields && typeof x.fields === "object" && !Array.isArray(x.fields) ? x.fields : {};
  const blocksBody = x.blocksBody;
  if (!documentType) return blocksBody;
  return { documentType, fields, blocksBody };
}
