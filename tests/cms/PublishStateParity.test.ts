import { describe, expect, it } from "vitest";
import { parseBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { stampVariantPublishLayer } from "@/lib/cms/contentNodeEnvelope";

describe("PublishStateParity", () => {
  it("stampVariantPublishLayer records published state", () => {
    const layer = stampVariantPublishLayer("published");
    expect(layer.state).toBe("published");
    expect(layer.updatedAt).toMatch(/^\d{4}-/);
  });

  it("parseBodyEnvelope reads cmsVariantPublish when present", () => {
    const body = {
      documentType: "page",
      invariantFields: {},
      cultureFields: {},
      blocksBody: { blocks: [] },
      cmsVariantPublish: { state: "draft", updatedAt: "2026-01-01T00:00:00.000Z" },
    };
    const e = parseBodyEnvelope(body);
    expect(e.cmsVariantPublish?.state).toBe("draft");
  });
});
