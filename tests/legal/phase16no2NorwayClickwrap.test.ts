import { describe, expect, it } from "vitest";
import {
  assertNorwayDocsNotForgedLegalApproved,
  buildNorwayLegalDocuments,
  getNorwayDocument,
  NORWAY_LEGAL_STATUS,
  NORWAY_REQUIRED_DOCS_BY_ROLE,
  requiredNorwayDocumentsForRole,
} from "@/lib/legal/norwayDocuments";
import {
  needsReacceptance,
  roleCannotAcceptOtherRoleDocs,
  validateNorwayAcceptanceBatch,
} from "@/lib/legal/norwayAcceptanceValidate";
import { isOtherCountryProductionBlocked } from "@/lib/markets/norwayFirstActivation";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { buildCountryInvariant } from "@/lib/markets/commercialModelInvariant";

function validBatch(role: "provider" | "company" | "employee") {
  return requiredNorwayDocumentsForRole(role).map((d) => ({
    documentType: d.documentType,
    documentVersion: d.version,
    documentChecksum: d.checksum,
    accepted: true as const,
  }));
}

describe("Phase 16NO.2 — Norway legal clickwrap", () => {
  it("keeps OWNER_APPROVED_EXTERNAL_REVIEW_PENDING and never forges LEGAL_APPROVED", () => {
    expect(NORWAY_LEGAL_STATUS).toBe("OWNER_APPROVED_EXTERNAL_REVIEW_PENDING");
    assertNorwayDocsNotForgedLegalApproved();
    for (const d of buildNorwayLegalDocuments()) {
      expect(d.norwayLegalStatus).toBe(NORWAY_LEGAL_STATUS);
      expect(d.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(d.body).toContain("5 %");
      expect(d.body).not.toContain("LEGAL_APPROVED");
    }
  });

  it("requires acceptance and blocks unchecked checkbox", () => {
    expect(validateNorwayAcceptanceBatch({ role: "company", acceptances: null }).ok).toBe(false);
    expect(validateNorwayAcceptanceBatch({ role: "company", acceptances: [] }).ok).toBe(false);
    const unchecked = validBatch("company").map((x, i) =>
      i === 0 ? { ...x, accepted: false } : x,
    );
    const r = validateNorwayAcceptanceBatch({ role: "company", acceptances: unchecked });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe("UNCHECKED_BLOCKED");
  });

  it("blocks stale document version (reacceptance)", () => {
    const stale = validBatch("company").map((x, i) =>
      i === 0 ? { ...x, documentVersion: "0.0.1-stale", documentChecksum: "deadbeef".repeat(8) } : x,
    );
    const r = validateNorwayAcceptanceBatch({ role: "company", acceptances: stale });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe("STALE_OR_MISMATCHED_VERSION");
    const doc = getNorwayDocument("company_terms")!;
    expect(
      needsReacceptance(
        { documentVersion: "0.0.1-stale", documentChecksum: doc.checksum },
        "company_terms",
      ),
    ).toBe(true);
  });

  it("stores checksum identity on valid batch", () => {
    const r = validateNorwayAcceptanceBatch({ role: "company", acceptances: validBatch("company") });
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const item of r.items) {
        const doc = getNorwayDocument(item.documentType)!;
        expect(item.documentChecksum).toBe(doc.checksum);
      }
    }
  });

  it("provider terms not accepted by company role; company terms not by provider", () => {
    expect(roleCannotAcceptOtherRoleDocs("company", "provider_terms")).toBe(true);
    expect(roleCannotAcceptOtherRoleDocs("provider", "company_terms")).toBe(true);
    const companyTryingProvider = validateNorwayAcceptanceBatch({
      role: "company",
      acceptances: validBatch("provider"),
    });
    expect(companyTryingProvider.ok).toBe(false);
    if (companyTryingProvider.ok === false) {
      expect(companyTryingProvider.code).toBe("DOCUMENT_NOT_ALLOWED_FOR_ROLE");
    }
  });

  it("no default acceptance — every required doc must be explicit", () => {
    expect(NORWAY_REQUIRED_DOCS_BY_ROLE.provider.length).toBeGreaterThanOrEqual(5);
    expect(NORWAY_REQUIRED_DOCS_BY_ROLE.company.length).toBeGreaterThanOrEqual(3);
    expect(NORWAY_REQUIRED_DOCS_BY_ROLE.employee.length).toBeGreaterThanOrEqual(2);
    const incomplete = validBatch("company").slice(0, 1);
    const r = validateNorwayAcceptanceBatch({ role: "company", acceptances: incomplete });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe("ACCEPTANCE_REQUIRED");
  });

  it("consent cannot be inserted without actor (persist gate)", async () => {
    const { persistNorwayAcceptance } = await import("@/lib/legal/norwayAcceptanceGate");
    const doc = getNorwayDocument("company_terms")!;
    const r = await persistNorwayAcceptance({
      subjectType: "company",
      subjectId: "11111111-1111-4111-8111-111111111111",
      organizationId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "",
      documentType: doc.documentType,
      documentVersion: doc.version,
      documentChecksum: doc.checksum,
      accepted: true,
      clientIp: null,
      userAgent: null,
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe("ACTOR_REQUIRED");
  });

  it("all 20 other countries remain disabled; Stripe stays off", () => {
    let blocked = 0;
    for (const c of SUPPORTED_COUNTRY_CODES) {
      if (c === "NO") continue;
      expect(isOtherCountryProductionBlocked(c)).toBe(true);
      expect(buildCountryInvariant(c).stripeEnabled).toBe(false);
      blocked += 1;
    }
    expect(blocked).toBe(20);
    expect(buildCountryInvariant("NO").stripeEnabled).toBe(false);
  });

  it("accept route forbids superadmin fabricate (source lock)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/api/legal/norway/accept/route.ts"),
      "utf8",
    );
    expect(src).toContain("SUPERADMIN_FABRICATE_FORBIDDEN");
    expect(src).toContain("CROSS_TENANT_DENIED");
    expect(src).toContain("ROLE_MISMATCH");
  });

  it("register-company and provider-registration enforce server-side legal batch", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const company = fs.readFileSync(
      path.join(process.cwd(), "app/api/public/register-company/route.ts"),
      "utf8",
    );
    const provider = fs.readFileSync(
      path.join(process.cwd(), "app/api/public/provider-registration/route.ts"),
      "utf8",
    );
    expect(company).toContain("validateNorwayAcceptanceBatch");
    expect(provider).toContain('country_code === "NO"');
    expect(provider).toContain("validateNorwayAcceptanceBatch");
  });
});
