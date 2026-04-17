import { describe, it, expect } from "vitest";
import {
  OPERATIVE_AUDIT_EVENTS_OR,
  extractCompanyIdFromAuditDetail,
  resolveSuperadminAuditContextLinks,
} from "@/lib/audit/operativeAuditStream";

describe("operativeAuditStream", () => {
  it("OPERATIVE_AUDIT_EVENTS_OR dekker agreement.* og firmastatus", () => {
    expect(OPERATIVE_AUDIT_EVENTS_OR).toContain("agreement.%");
    expect(OPERATIVE_AUDIT_EVENTS_OR).toContain("COMPANY_STATUS_CHANGED");
    expect(OPERATIVE_AUDIT_EVENTS_OR).toContain("COMPANY_CREATED");
  });

  it("extractCompanyIdFromAuditDetail leser company_id", () => {
    expect(extractCompanyIdFromAuditDetail({ company_id: "00000000-0000-4000-8000-000000000099" })).toBe(
      "00000000-0000-4000-8000-000000000099"
    );
    expect(extractCompanyIdFromAuditDetail(null)).toBeNull();
  });

  it("resolveSuperadminAuditContextLinks gir avtale- og firmalenker", () => {
    const cid = "00000000-0000-4000-8000-0000000000aa";
    const aid = "00000000-0000-4000-8000-0000000000bb";
    const links = resolveSuperadminAuditContextLinks({
      action: "agreement.approve_active",
      entity_type: "agreement",
      entity_id: aid,
      detail: { company_id: cid },
    });
    const hrefs = links.map((l) => l.href);
    expect(hrefs.some((h) => h.includes(`/superadmin/agreements/${aid}`))).toBe(true);
    expect(hrefs.some((h) => h.includes(`/superadmin/companies/${cid}`))).toBe(true);
  });
});
