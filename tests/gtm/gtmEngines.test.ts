import { describe, expect, test } from "vitest";

import { upsertAttributionFromConversion } from "@/lib/gtm/attribution";
import { computeGtmPipelineMetrics, buildConversionEvent } from "@/lib/gtm/conversion";
import { ensureGtmLeadInSnapshot, appendGtmInteraction, emptyGtmCrmSnapshot } from "@/lib/gtm/crm";
import { classifyGtmReply } from "@/lib/gtm/responses";
import { scoreGtmLead } from "@/lib/gtm/scoring";
import { createGtmLead } from "@/lib/gtm/leads";
import { mergeGtmLeadsWithOutbound } from "@/lib/gtm/mergeLeads";
import type { OutboundLead } from "@/lib/outbound/lead";

describe("GTM engines", () => {
  test("classifyGtmReply detects kantine objection", () => {
    const r = classifyGtmReply("vi har kantine allerede");
    expect(r.kind).toBe("objection");
    if (r.kind === "objection") {
      expect(r.objectionId).toBe("has_canteen");
    }
  });

  test("classifyGtmReply detects interest", () => {
    const r = classifyGtmReply("Kult — kan vi ta en prat neste uke?");
    expect(r.kind).toBe("interest");
  });

  test("scoreGtmLead is 0–100", () => {
    const lead = createGtmLead({
      company: { name: "Test AS", employeeCount: 50, industry: "it" },
      contact: { email: "a@test.no", name: "A" },
      source: "website_inbound",
    });
    const s = scoreGtmLead(lead, { visits: 3, clicks: 1 });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  test("CRM ensure + interaction", () => {
    const lead = createGtmLead({
      company: { name: "X" },
      contact: {},
      source: "manual",
    });
    let s = emptyGtmCrmSnapshot();
    s = ensureGtmLeadInSnapshot(s, lead);
    s = appendGtmInteraction(s, lead.id, { channel: "email", summary: "utkast" });
    expect(s.leads[0].interactions).toHaveLength(1);
  });

  test("pipeline metrics", () => {
    const lead = createGtmLead({
      company: { name: "Y" },
      contact: {},
      source: "manual",
      status: "interested",
    });
    const conv = buildConversionEvent({ leadId: lead.id, kind: "deal_closed", valueNok: 10000 });
    const m = computeGtmPipelineMetrics({
      leads: [lead],
      conversions: [conv],
    });
    expect(m.dealsClosed).toBe(1);
    expect(m.revenueNok).toBe(10000);
  });

  test("attribution upsert", () => {
    const ev = buildConversionEvent({
      leadId: "l1",
      kind: "deal_closed",
      valueNok: 5000,
      campaignId: "c1",
    });
    const next = upsertAttributionFromConversion([], ev, undefined);
    expect(next).toHaveLength(1);
    expect(next[0].revenueNok).toBe(5000);
  });

  test("merge outbound + crm", () => {
    const ob: OutboundLead = {
      id: "obl_x",
      companyName: "Acme",
      industry: "it",
      role: "hr",
    };
    const snap = emptyGtmCrmSnapshot();
    const merged = mergeGtmLeadsWithOutbound([ob], snap);
    expect(merged).toHaveLength(1);
    expect(merged[0].company.name).toBe("Acme");
    expect(merged[0].id).toBe("gtm_ob_obl_x");
  });
});
