import { describe, expect, it } from "vitest";

import { IntelligenceSchemaValidationError } from "@/lib/ai/schema/errors";
import { validateEvent, validatePersistedIntelligenceEvent } from "@/lib/ai/schema/validate";

const minimalGtmLead = {
  id: "lead_test_1",
  company: { name: "Acme AS" },
  contact: {},
  source: "manual" as const,
  score: 72,
  status: "contacted" as const,
  createdAt: "2025-01-01T12:00:00.000Z",
  updatedAt: "2025-01-02T12:00:00.000Z",
  interactions: [] as const,
};

describe("lib/ai/schema validateEvent", () => {
  it("accepts a valid gtm_outcome payload", () => {
    const v = validateEvent({
      type: "gtm",
      source: "unit_test",
      payload: {
        kind: "gtm_outcome",
        lead: minimalGtmLead,
        templateKey: "intro_v1",
        channel: "email",
        classification: { kind: "interest", confidence: 0.91 },
      },
    });
    expect(v.payload.kind).toBe("gtm_outcome");
    expect(v.source).toBe("unit_test");
  });

  it("accepts outreach_sent", () => {
    validateEvent({
      type: "gtm",
      source: "unit_test",
      payload: {
        kind: "outreach_sent",
        channel: "linkedin",
        leadId: "lead_test_1",
        templateKey: "intro_v1",
        campaignId: "cms_page:page-1",
      },
    });
  });

  it("accepts gtm_conversion", () => {
    validateEvent({
      type: "conversion",
      source: "unit_test",
      payload: {
        kind: "gtm_conversion",
        conversionKind: "meeting_booked",
        leadId: "lead_test_1",
        campaignId: "cms_page:page-1",
        companyName: "Acme AS",
      },
    });
  });

  it("accepts revenue_insights", () => {
    validateEvent({
      type: "analytics",
      source: "unit_test",
      payload: {
        kind: "revenue_insights",
        pageId: "p1",
        sampleOk: true,
        pageCtr: 0.02,
        topWeakIssues: ["weak cta"],
        ctaFocus: null,
        strongestCtaBlockId: null,
      },
    });
  });

  it("accepts revenue_event", () => {
    validateEvent({
      type: "analytics",
      source: "unit_test",
      payload: {
        kind: "revenue_event",
        revenue: 199.5,
        blockId: "blk_1",
      },
    });
  });

  it("rejects invalid envelope (empty source)", () => {
    expect(() =>
      validateEvent({
        type: "gtm",
        source: "",
        payload: { kind: "outreach_sent", channel: "email", leadId: "x", templateKey: "t", campaignId: "c" },
      }),
    ).toThrow(IntelligenceSchemaValidationError);
  });

  it("rejects wrong payload kind for domain (gtm_conversion under gtm)", () => {
    expect(() =>
      validateEvent({
        type: "gtm",
        source: "x",
        payload: {
          kind: "gtm_conversion",
          conversionKind: "meeting_booked",
          leadId: "l",
          campaignId: "c",
          companyName: "Co",
        },
      }),
    ).toThrow(IntelligenceSchemaValidationError);
  });

  it("rejects gtm_outcome missing classification", () => {
    expect(() =>
      validateEvent({
        type: "gtm",
        source: "x",
        payload: {
          kind: "gtm_outcome",
          lead: minimalGtmLead,
          templateKey: "t",
          channel: "email",
        },
      }),
    ).toThrow(IntelligenceSchemaValidationError);
  });

  it("rejects unknown payload kind", () => {
    expect(() =>
      validateEvent({
        type: "analytics",
        source: "x",
        payload: { kind: "totally_unknown", foo: 1 },
      }),
    ).toThrow(IntelligenceSchemaValidationError);
  });
});

describe("validatePersistedIntelligenceEvent", () => {
  it("validates a full row", () => {
    const row = validatePersistedIntelligenceEvent({
      id: "evt_1",
      type: "analytics",
      source: "s",
      timestamp: 1_700_000_000_000,
      payload: {
        kind: "learning_pair",
        change: "c",
        result: "r",
      },
    });
    expect(row.id).toBe("evt_1");
  });
});
