/**
 * Body envelope for CMS page variants — én kontrakt for app editor og API-validering.
 * U98 — invariantFields + cultureFields (Umbraco-lignende variation); legacy `fields` støttes ved lesing.
 */

export type CmsSaveStamp = { at: string; locale?: string };

/** Per variant row — node-level `content_pages.status` er fortsatt autoritativ for offentlig gating. */
export type CmsVariantPublishLayer = {
  state: "draft" | "published";
  updatedAt?: string;
};

export type ParsedBodyEnvelope = {
  documentType: string | null;
  /** Flattened lag for bakoverkompatibilitet: invariant ∪ culture (culture vinner ved nøkkelkollisjon). */
  fields: Record<string, unknown>;
  invariantFields: Record<string, unknown>;
  cultureFields: Record<string, unknown>;
  blocksBody: string | unknown;
  cmsSaveStamp?: CmsSaveStamp;
  cmsVariantPublish?: CmsVariantPublishLayer;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

export function parseBodyEnvelope(body: unknown): ParsedBodyEnvelope {
  if (body != null && typeof body === "object" && "documentType" in body) {
    const b = body as Record<string, unknown>;
    const blocksBody = b.blocksBody !== undefined && b.blocksBody !== null ? b.blocksBody : "";
    const invariantFields = isPlainObject(b.invariantFields) ? { ...b.invariantFields } : {};
    let cultureFields: Record<string, unknown>;
    if (isPlainObject(b.cultureFields)) {
      cultureFields = { ...b.cultureFields };
    } else if (isPlainObject(b.fields)) {
      cultureFields = { ...b.fields };
    } else {
      cultureFields = {};
    }
    const fields = { ...invariantFields, ...cultureFields };
    const cmsSaveStamp =
      b.cmsSaveStamp && typeof b.cmsSaveStamp === "object" && !Array.isArray(b.cmsSaveStamp)
        ? (b.cmsSaveStamp as CmsSaveStamp)
        : undefined;
    const cmsVariantPublish =
      b.cmsVariantPublish && typeof b.cmsVariantPublish === "object" && !Array.isArray(b.cmsVariantPublish)
        ? (b.cmsVariantPublish as CmsVariantPublishLayer)
        : undefined;
    return {
      documentType: (b.documentType as string) ?? null,
      fields,
      invariantFields,
      cultureFields,
      blocksBody,
      cmsSaveStamp,
      cmsVariantPublish,
    };
  }
  if (body != null && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.blocks)) {
      return {
        documentType: null,
        fields: {},
        invariantFields: {},
        cultureFields: {},
        blocksBody: body,
      };
    }
  }
  if (typeof body === "string") {
    return { documentType: null, fields: {}, invariantFields: {}, cultureFields: {}, blocksBody: body };
  }
  return { documentType: null, fields: {}, invariantFields: {}, cultureFields: {}, blocksBody: "" };
}

export function serializeBodyEnvelope(x: {
  documentType: string | null;
  /** @deprecated Bruk invariantFields + cultureFields */
  fields?: Record<string, unknown>;
  invariantFields?: Record<string, unknown>;
  cultureFields?: Record<string, unknown>;
  blocksBody: unknown;
  cmsSaveStamp?: CmsSaveStamp;
  cmsVariantPublish?: CmsVariantPublishLayer;
}): unknown {
  const documentType =
    typeof x.documentType === "string" && x.documentType.trim() !== "" ? x.documentType.trim() : null;
  const blocksBody = x.blocksBody;
  if (!documentType) return blocksBody;

  const invariantFields =
    x.invariantFields && typeof x.invariantFields === "object" && !Array.isArray(x.invariantFields)
      ? x.invariantFields
      : {};
  const cultureFieldsRaw =
    x.cultureFields && typeof x.cultureFields === "object" && !Array.isArray(x.cultureFields)
      ? x.cultureFields
      : x.fields && typeof x.fields === "object" && !Array.isArray(x.fields)
        ? x.fields
        : {};

  const out: Record<string, unknown> = {
    documentType,
    invariantFields,
    cultureFields: cultureFieldsRaw,
    blocksBody,
  };
  if (x.cmsSaveStamp) out.cmsSaveStamp = x.cmsSaveStamp;
  if (x.cmsVariantPublish) out.cmsVariantPublish = x.cmsVariantPublish;
  return out;
}
