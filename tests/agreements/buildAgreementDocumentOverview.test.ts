import { describe, expect, it } from "vitest";
import { buildAgreementDocumentOverview } from "@/lib/agreements/buildAgreementDocumentOverview";

describe("buildAgreementDocumentOverview", () => {
  it("tom liste uten firma-id", () => {
    expect(buildAgreementDocumentOverview({ companyId: "", agreementJson: null, termsAcceptanceRows: [], companyAgreementId: null, legacyAgreementId: null })).toEqual([]);
  });

  it("tar med PDF når pdfPath er trygg og sorterer nyeste først", () => {
    const rows = buildAgreementDocumentOverview({
      companyId: "c1",
      agreementJson: { terms: { pdfPath: "c1/contract.pdf", accepted_at: "2024-06-01" } },
      termsAcceptanceRows: [
        { id: "t1", version: "v1", accepted_at: "2024-01-15T10:00:00Z", credit_check_system: "tripletex" },
      ],
      companyAgreementId: "led-1",
      legacyAgreementId: "agr-9",
    });
    expect(rows.length).toBe(2);
    expect(rows[0].source).toBe("agreement_pdf");
    expect(rows[0].storage_path).toBe("c1/contract.pdf");
    expect(rows[0].company_agreement_id).toBe("led-1");
    expect(rows[1].source).toBe("terms_acceptance");
    expect(rows[1].version).toBe("v1");
  });

  it("ignorerer utrygg lagringssti", () => {
    const rows = buildAgreementDocumentOverview({
      companyId: "c1",
      agreementJson: { terms: { pdfPath: "../evil.pdf" } },
      termsAcceptanceRows: [],
      companyAgreementId: null,
      legacyAgreementId: null,
    });
    expect(rows).toEqual([]);
  });
});
