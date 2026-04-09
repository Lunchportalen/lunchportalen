/**
 * Enterprise GTM — typer delt mellom motorer og CMS (ingen sideeffekter her).
 */

export type GtmLeadSource = "manual" | "scraped_controlled" | "website_inbound";

export type GtmLeadStatus = "new" | "contacted" | "interested" | "closed";

export type GtmLead = {
  id: string;
  company: {
    name: string;
    /** Antall ansatte eller estimat — brukes i scoring */
    employeeCount?: number;
    industry?: string;
  };
  contact: {
    name?: string;
    email?: string;
    linkedinUrl?: string;
    role?: string;
  };
  source: GtmLeadSource;
  /** 0–100, satt av scoring-motor */
  score: number;
  status: GtmLeadStatus;
  /** Kampanje / innhold / UTM — for attributjon */
  campaignId?: string;
  createdAt: string;
  updatedAt: string;
  interactions: GtmInteraction[];
};

export type GtmInteractionChannel = "email" | "linkedin" | "manual_note" | "inbound_form";

export type GtmInteraction = {
  id: string;
  at: string;
  channel: GtmInteractionChannel;
  /** Kort hva som skjedde — alltid loggført */
  summary: string;
  /** Klassifisering fra response-motor */
  replyKind?: GtmReplyClassification["kind"];
  metadata?: Record<string, string | number | boolean | null>;
};

export type GtmReplyClassification = {
  kind: "interest" | "rejection" | "objection" | "neutral";
  confidence: number;
  /** Når objection: kobling til outbound objections */
  objectionId?: "has_canteen";
  notes?: string;
};

export type GtmConversionKind = "meeting_booked" | "deal_closed";

export type GtmConversionEvent = {
  id: string;
  leadId: string;
  kind: GtmConversionKind;
  /** NOK heltall — om kjent */
  valueNok?: number;
  at: string;
  campaignId?: string;
};

export type GtmAttributionLink = {
  leadId: string;
  campaignId: string;
  /** Kumulativt attribuert (kan oppdateres ved deal) */
  revenueNok?: number;
  lastTouchAt: string;
};

export type GtmAuditEntry = {
  id: string;
  at: string;
  action: string;
  leadId?: string;
  detail?: Record<string, unknown>;
};

export type GtmCrmSnapshot = {
  version: 1;
  leads: GtmLead[];
  conversions: GtmConversionEvent[];
  attribution: GtmAttributionLink[];
  audit: GtmAuditEntry[];
};

export type GtmLearningSnapshot = {
  version: 1;
  /** channel:templateKey -> aggregering */
  messageStats: Record<string, { touches: number; positiveOutcomes: number }>;
  /** industry key -> respons */
  industryStats: Record<string, { outreach: number; interestSignals: number }>;
  /** tilbud / pitch-type */
  offerStats: Record<string, { attempts: number; conversions: number }>;
};
