/**
 * Utgående B2B-leads — manuell/import, ingen scraping.
 */

export type OutboundLead = {
  id: string;
  companyName: string;
  /** Fri tekst eller kjent nøkkel (it, office, …) — normaliseres i personalize */
  industry: string;
  /** Fri tekst eller kjent nøkkel (hr, manager, …) */
  role: string;
  contactName?: string;
  email?: string;
  linkedinUrl?: string;
  companySize?: number;
};

export function newOutboundLeadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `obl_${crypto.randomUUID()}`;
  }
  return `obl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createOutboundLead(input: Omit<OutboundLead, "id">): OutboundLead {
  return {
    id: newOutboundLeadId(),
    companyName: String(input.companyName ?? "").trim() || "Ukjent selskap",
    industry: String(input.industry ?? "").trim() || "office",
    role: String(input.role ?? "").trim() || "office",
    contactName: input.contactName?.trim() || undefined,
    email: input.email?.trim() || undefined,
    linkedinUrl: input.linkedinUrl?.trim() || undefined,
    companySize: typeof input.companySize === "number" && Number.isFinite(input.companySize) ? input.companySize : undefined,
  };
}
