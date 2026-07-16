/**
 * Phase 15G.3B — classify every critical tax/legal question.
 * Factual closures use official sources only.
 * Judgment stays EXTERNAL_DECISION_REQUIRED with a reviewer task.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { COUNTRY_TAX_PACKS } from "@/lib/tax/packs/countryTaxPacks";
import type { ReviewerRole } from "@/lib/review/reviewWorkflow";

export type CriticalQuestionStatus =
  | "CLOSED_FACTUAL"
  | "EXTERNAL_DECISION_REQUIRED"
  | "UNCLASSIFIED";

export type CriticalQuestionRecord = {
  questionId: string;
  countryCode: CountryCode;
  locale: string | null;
  jurisdiction: string | null;
  riskCategory: "tax" | "legal" | "invoice" | "e_invoice" | "privacy" | "marketplace" | "registration";
  whyItMatters: string;
  knownFacts: string[];
  officialSources: string[];
  competingInterpretations: string[];
  technicalAssumption: string;
  requiredReviewerRole: ReviewerRole;
  decisionOptions: string[];
  consequences: string[];
  failClosedDefault: string;
  status: CriticalQuestionStatus;
  completionArtifact: string;
  reviewerTaskSubjectId: string;
  dueStatus: "OPEN" | "CLOSED";
};

const RC = "b88aaf99780e0a5d71404e831fd87eb90031fb6e";

function q(
  partial: Omit<CriticalQuestionRecord, "reviewerTaskSubjectId" | "dueStatus"> & {
    reviewerTaskSubjectId?: string;
  },
): CriticalQuestionRecord {
  return {
    dueStatus: partial.status === "CLOSED_FACTUAL" ? "CLOSED" : "OPEN",
    reviewerTaskSubjectId:
      partial.reviewerTaskSubjectId ??
      `critical-q:${partial.questionId}:${partial.countryCode}:${RC}`,
    ...partial,
  };
}

/** Factual closures that do not require legal judgment. */
function factualClosures(countryCode: CountryCode): CriticalQuestionRecord[] {
  const tax = COUNTRY_TAX_PACKS[countryCode];
  const out: CriticalQuestionRecord[] = [];

  out.push(
    q({
      questionId: `${countryCode}-TAX-STRATEGY-DOCUMENTED`,
      countryCode,
      locale: null,
      jurisdiction: null,
      riskCategory: "tax",
      whyItMatters: "Resolver must know VAT vs sales_tax vs GST strategy",
      knownFacts: [`taxStrategy=${tax.taxStrategy}`, `officialSources=${tax.officialSources.length}`],
      officialSources: tax.officialSources.map((s) => s.sourceUrl),
      competingInterpretations: [],
      technicalAssumption: `Use pack taxStrategy=${tax.taxStrategy} fail-closed until APPROVED rates`,
      requiredReviewerRole: "tax_reviewer",
      decisionOptions: ["Keep researched strategy", "Change strategy after review"],
      consequences: ["Wrong strategy breaks tax display and invoices"],
      failClosedDefault: "Block cutover until TAX_APPROVED",
      status: "CLOSED_FACTUAL",
      completionArtifact: "countryTaxPacks.taxStrategy + allowlisted sources",
    }),
  );

  if (countryCode === "US") {
    out.push(
      q({
        questionId: "US-NO-FEDERAL-EINVOICE-MANDATE",
        countryCode: "US",
        locale: null,
        jurisdiction: "US",
        riskCategory: "e_invoice",
        whyItMatters: "E-invoice gate must not block US on Peppol/CTC",
        knownFacts: ["Registry marks US e-invoice NOT_APPLICABLE", "PDF/email + accounting export only"],
        officialSources: ["https://www.streamlinedsalestax.org/"],
        competingInterpretations: ["State B2G e-invoicing may exist for public sector — out of launch scope"],
        technicalAssumption: "National B2B CTC mandate not applicable for this product scope",
        requiredReviewerRole: "tax_reviewer",
        decisionOptions: ["Confirm N/A", "Require state-specific B2G path"],
        consequences: ["If reversed, US needs e-invoice adapter + credentials"],
        failClosedDefault: "Keep NOT_APPLICABLE until tax reviewer confirms otherwise",
        status: "CLOSED_FACTUAL",
        completionArtifact: "eInvoiceRegistry US NOT_APPLICABLE",
      }),
    );
  }

  return out;
}

function judgmentFromOpenQuestions(countryCode: CountryCode): CriticalQuestionRecord[] {
  const tax = COUNTRY_TAX_PACKS[countryCode];
  return tax.openQuestions.map((text, idx) =>
    q({
      questionId: `${countryCode}-OPEN-${idx + 1}`,
      countryCode,
      locale: null,
      jurisdiction: countryCode === "US" || countryCode === "CA" ? `${countryCode}-*` : countryCode,
      riskCategory: "tax",
      whyItMatters: "Affects rate matrix, invoice wording, and registration model",
      knownFacts: ["Pack status RESEARCHED", "Technical resolver fail-closed without APPROVED rules"],
      officialSources: tax.officialSources.map((s) => s.sourceUrl),
      competingInterpretations: [
        "Reduced vs standard rates may differ for cold food / hot takeaway / staffed catering",
        "B2B reverse charge may or may not apply depending on supply place and customer status",
      ],
      technicalAssumption: text.includes("Confirm")
        ? "No APPROVED rate applied until external tax sign-off"
        : "Fail-closed: block activation",
      requiredReviewerRole: "tax_reviewer",
      decisionOptions: [
        "Approve researched classification",
        "Request changes with alternate authority cite",
        "Reject and block country",
      ],
      consequences: [
        "APPROVE → unlocks tax lane for cutover checklist",
        "REQUEST_CHANGES → queue EXPIRED/reopen",
        "REJECT → country remains blocked",
      ],
      failClosedDefault: "Do not activate country; keep RESEARCHED ≠ APPROVED",
      status: "EXTERNAL_DECISION_REQUIRED",
      completionArtifact: `Signed tax decision answering: ${text}`,
    }),
  );
}

function structuralJudgment(countryCode: CountryCode): CriticalQuestionRecord[] {
  const base: Array<Omit<CriticalQuestionRecord, "reviewerTaskSubjectId" | "dueStatus" | "countryCode">> = [
    {
      questionId: `${countryCode}-MKT-PLATFORM-ROLE`,
      locale: null,
      jurisdiction: countryCode,
      riskCategory: "marketplace",
      whyItMatters: "Determines invoice issuer, tax-liable party, allergen/delivery liability",
      knownFacts: ["Draft disclosed_agent model in marketplaceLegalModel"],
      officialSources: [],
      competingInterpretations: ["Platform as principal vs disclosed agent vs marketplace facilitator"],
      technicalAssumption: "Provider invoices food; platform invoices 5% commission (DRAFT)",
      requiredReviewerRole: "legal_reviewer",
      decisionOptions: ["Approve disclosed_agent", "Redefine principal model", "Reject"],
      consequences: ["Wrong model creates tax and consumer-law exposure"],
      failClosedDefault: "Block LEGAL_APPROVED / cutover",
      status: "EXTERNAL_DECISION_REQUIRED",
      completionArtifact: "Signed marketplace/legal model approval",
    },
    {
      questionId: `${countryCode}-PRIVACY-CONTROLLER`,
      locale: null,
      jurisdiction: countryCode,
      riskCategory: "privacy",
      whyItMatters: "Controller/processor mapping drives DPA and transfer basis",
      knownFacts: ["Draft privacy stubs exist per locale"],
      officialSources: [],
      competingInterpretations: ["Platform controller vs joint controllership with provider/company"],
      technicalAssumption: "Platform as controller for account data; provider for meal content",
      requiredReviewerRole: "legal_reviewer",
      decisionOptions: ["Approve mapping", "Request changes", "Reject"],
      consequences: ["Wrong mapping invalidates DPA and notices"],
      failClosedDefault: "Block PRIVACY_APPROVED",
      status: "EXTERNAL_DECISION_REQUIRED",
      completionArtifact: "Signed privacy/DPA approval",
    },
  ];

  if (countryCode !== "US") {
    base.push({
      questionId: `${countryCode}-EINVOICE-MANDATE`,
      locale: null,
      jurisdiction: countryCode,
      riskCategory: "e_invoice",
      whyItMatters: "Mandate timing drives Peppol/CTC credentials and adapter path",
      knownFacts: ["Capability RESEARCHED/OPTIONAL in registry", "Adapters STUB"],
      officialSources: [],
      competingInterpretations: ["Mandate already in force vs phased B2B rollout"],
      technicalAssumption: "No live legal e-invoice issuance until APPROVED + credentials",
      requiredReviewerRole: "tax_reviewer",
      decisionOptions: ["Approve researched mandate status", "Mark REQUIRED with date", "Reject"],
      consequences: ["Wrong date → compliance failure on go-live"],
      failClosedDefault: "Block e-invoice lane / cutover",
      status: "EXTERNAL_DECISION_REQUIRED",
      completionArtifact: "Signed e-invoice mandate decision + live registration if required",
    });
  }

  if (countryCode === "US") {
    base.push({
      questionId: "US-NEXUS-MARKETPLACE-FACILITATOR",
      locale: null,
      jurisdiction: "US-*",
      riskCategory: "tax",
      whyItMatters: "State nexus and facilitator rules decide registration footprint",
      knownFacts: ["51 paths technically classified; launch footprint unsigned"],
      officialSources: ["https://www.streamlinedsalestax.org/"],
      competingInterpretations: ["Platform as marketplace facilitator vs provider as seller"],
      technicalAssumption: "No state activation without per-state evidence + TAX_APPROVAL",
      requiredReviewerRole: "tax_reviewer",
      decisionOptions: ["Approve launch-state set", "Expand/restrict footprint", "Reject"],
      consequences: ["Incorrect facilitator treatment creates tax debt"],
      failClosedDefault: "Keep states blocked for cutover",
      status: "EXTERNAL_DECISION_REQUIRED",
      completionArtifact: "Signed US footprint + facilitator assessment",
    });
  }

  if (countryCode === "CA") {
    base.push({
      questionId: "CA-PST-QST-COMPONENTS",
      locale: null,
      jurisdiction: "CA-*",
      riskCategory: "tax",
      whyItMatters: "GST/HST/PST/QST components vary by province",
      knownFacts: ["CRA GST/HST source linked", "13 paths technically present"],
      officialSources: [
        "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html",
      ],
      competingInterpretations: ["Place-of-supply for catering vs goods"],
      technicalAssumption: "No provincial activation without component approval",
      requiredReviewerRole: "tax_reviewer",
      decisionOptions: ["Approve provincial model", "Request changes", "Reject"],
      consequences: ["Wrong PST/QST treatment breaks invoices"],
      failClosedDefault: "Block CA cutover",
      status: "EXTERNAL_DECISION_REQUIRED",
      completionArtifact: "Signed Canada component model approval",
    });
  }

  return base.map((b) => q({ ...b, countryCode }));
}

export function classifyCriticalQuestionsForCountry(countryCode: CountryCode): CriticalQuestionRecord[] {
  return [
    ...factualClosures(countryCode),
    ...judgmentFromOpenQuestions(countryCode),
    ...structuralJudgment(countryCode),
  ];
}

export function classifyAllCriticalQuestions() {
  const all = SUPPORTED_COUNTRY_CODES.flatMap(classifyCriticalQuestionsForCountry);
  return {
    total: all.length,
    closedFactual: all.filter((q) => q.status === "CLOSED_FACTUAL").length,
    externalDecisionRequired: all.filter((q) => q.status === "EXTERNAL_DECISION_REQUIRED").length,
    unclassified: all.filter((q) => q.status === "UNCLASSIFIED").length,
    withoutTask: all.filter((q) => !q.reviewerTaskSubjectId).length,
    questions: all,
  };
}
