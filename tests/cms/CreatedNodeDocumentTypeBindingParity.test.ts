import { describe, expect, it } from "vitest";
import { parseBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { buildCreatePayloadForDocumentType } from "@/lib/cms/contentCreateFlow";

describe("CreatedNodeDocumentTypeBindingParity (U97E)", () => {
  it("create payload binder ny node til valgt documentTypeAlias", () => {
    const payload = buildCreatePayloadForDocumentType("compact_page");
    const env = parseBodyEnvelope(payload.body);
    expect(env.documentType).toBe("compact_page");
  });
});
