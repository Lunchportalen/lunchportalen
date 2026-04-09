/**
 * Sikkerhetslag — blokkerer eller flagger forslag som bryter enterprise-regler.
 * Ingen sideeffekter. Reversibelt: avviste forslag kan vises som «blokkert» med årsak.
 */

import type { AutonomyLevel } from "@/lib/ai/autonomyController";
import type { DecisionResult } from "@/lib/ai/decisionEngine";

export type PolicyRules = {
  /** Maks prisjustering i % (absolutt). */
  maxPriceDeltaPercent: number;
  /** Aldri tillat modellen å «gå forbi» dette autonominivået. */
  maxAutonomyLevel: AutonomyLevel;
  /** Krever aktiv avtale før operative forslag (unntatt ren observasjon). */
  requireAgreementForActions: boolean;
  /** Blokkerte leverandør-ID-er (simulert innkjøpsnettverk). */
  blockedSupplierIds?: string[];
  /** Gulv/tak for porsjonspris ex. mva (NOK) — kun signal i V1. */
  minPriceExVatNok?: number | null;
  maxPriceExVatNok?: number | null;
  /** Region (f.eks. by): myk grense for samtidige kjøkken-hubber i planlegging. */
  regionMaxKitchens?: Record<string, number>;
};

export const DEFAULT_POLICY_RULES: PolicyRules = {
  maxPriceDeltaPercent: 10,
  maxAutonomyLevel: 2,
  requireAgreementForActions: true,
};

export type PolicyDecisionContext = {
  hasActiveAgreement: boolean;
  rules: PolicyRules;
  /** Faktisk konfigurert autonomi (0–2). */
  configuredAutonomyLevel: AutonomyLevel;
};

export type PolicyEvaluation = {
  allowed: boolean;
  blockedReasons: string[];
  /** Nedgradert autonomi hvis policy krever det (aldri oppgradert). */
  effectiveAutonomyLevel: AutonomyLevel;
};

function clampLevel(n: number): AutonomyLevel {
  if (n <= 0) return 0;
  if (n >= 2) return 2;
  return 1;
}

/**
 * Regler (V1, deterministisk):
 * - Uten avtale: blokker alt som ikke er rent informativt (type pricing/menu purchase delivery med handling).
 * - Prisforslag over maxPriceDeltaPercent blokkeres.
 * - Autonomi kan aldri overstige maxAutonomyLevel eller policy cap.
 */
export function evaluatePolicyForDecision(
  decisionType: "menu" | "purchase" | "pricing" | "delivery",
  opts: {
    /** Foreslått prisendring i % (kan være negativ). */
    proposedPriceDeltaPercent?: number | null;
    ctx: PolicyDecisionContext;
  },
): PolicyEvaluation {
  const blockedReasons: string[] = [];
  let allowed = true;

  const effectiveAutonomyLevel = clampLevel(
    Math.min(opts.ctx.configuredAutonomyLevel, opts.ctx.rules.maxAutonomyLevel),
  );

  if (opts.ctx.rules.requireAgreementForActions && !opts.ctx.hasActiveAgreement) {
    allowed = false;
    blockedReasons.push("Mangler aktiv avtale — operative forslag er blokkert (fail-safe).");
  }

  if (decisionType === "pricing") {
    const d = Math.abs(Number(opts.proposedPriceDeltaPercent) || 0);
    if (d > opts.ctx.rules.maxPriceDeltaPercent + 1e-6) {
      allowed = false;
      blockedReasons.push(
        `Prisjustering ${d.toFixed(1)} % overstiger maksgrense ±${opts.ctx.rules.maxPriceDeltaPercent} %.`,
      );
    }
  }

  return { allowed, blockedReasons, effectiveAutonomyLevel };
}

export type SupplierPolicyResult = { allowed: boolean; reasons: string[] };

export function evaluateSupplierPolicy(supplierId: string, rules: PolicyRules): SupplierPolicyResult {
  const id = String(supplierId ?? "").trim();
  const blocked = rules.blockedSupplierIds ?? [];
  if (id && blocked.includes(id)) {
    return { allowed: false, reasons: [`Leverandør ${id} er blokkert i policy (manuell eskalering).`] };
  }
  return { allowed: true, reasons: [] };
}

export type PriceBandResult = { inBand: boolean; reasons: string[] };

export function evaluatePriceBand(priceExVat: number | null, rules: PolicyRules): PriceBandResult {
  if (priceExVat == null || !Number.isFinite(priceExVat)) {
    return { inBand: true, reasons: ["Ingen pris satt — prisbånd evalueres ikke."] };
  }
  const reasons: string[] = [];
  let ok = true;
  const min = rules.minPriceExVatNok;
  const max = rules.maxPriceExVatNok;
  if (min != null && Number.isFinite(min) && priceExVat < min - 1e-6) {
    ok = false;
    reasons.push(`Pris under policygulv (${min} NOK ex. mva).`);
  }
  if (max != null && Number.isFinite(max) && priceExVat > max + 1e-6) {
    ok = false;
    reasons.push(`Pris over policytak (${max} NOK ex. mva).`);
  }
  if (ok && (min != null || max != null)) reasons.push("Pris innenfor konfigurert bånd.");
  return { inBand: ok, reasons };
}

/**
 * Lesbare policy-signaler til kontrolltårn / decision stream (ingen sideeffekter).
 */
export function buildOperationsPolicyNotes(opts: {
  rules: PolicyRules;
  currentPriceExVat: number | null;
  supplierIdsInPlan: string[];
}): string[] {
  const notes: string[] = [];
  const band = evaluatePriceBand(opts.currentPriceExVat, opts.rules);
  notes.push(...band.reasons);

  for (const sid of opts.supplierIdsInPlan.slice(0, 8)) {
    const sp = evaluateSupplierPolicy(sid, opts.rules);
    if (!sp.allowed) notes.push(...sp.reasons);
  }

  const rm = opts.rules.regionMaxKitchens;
  if (rm && Object.keys(rm).length) {
    notes.push(`Regionregler aktive: ${Object.keys(rm).length} nøkkel(er) — brukes som myke begrensninger i planlegging.`);
  }

  if (notes.length === 0) {
    notes.push("Standard policy (DEFAULT_POLICY_RULES) — ingen ekstra region- eller leverandøravvik registrert i snapshot.");
  }

  return notes;
}

/** Legacy / HTTP policy surface — deterministisk, tillatende fallback når detaljert kontekst mangler. */
export type LegacyPolicyEvaluation = {
  allowed: boolean;
  /** Lesbar forklaring (runner, POS, dashbord). */
  explain: string;
  requiresApproval: boolean;
  /** Ekstra årsaker (skalering / introspection). */
  reasons: string[];
};

/**
 * Tillater alle handlinger i sikker liste (legacy CEO-strenger og fremtidige verb).
 * Alltid deterministisk; ingen nettverk.
 */
export function isActionAllowed(_action: string): boolean {
  return true;
}

/**
 * Legacy policy-evaluering for {@link DecisionResult} og eldre «synthetic» objekter.
 * Mapper ikke til {@link evaluatePolicyForDecision} uten full operativ kontekst — fail-safe: tillat med godkjenning.
 */
export function evaluatePolicy(
  decision: DecisionResult | Record<string, unknown>,
  ..._rest: unknown[]
): LegacyPolicyEvaluation {
  const dt =
    decision && typeof decision === "object" && typeof (decision as { decisionType?: unknown }).decisionType === "string"
      ? String((decision as { decisionType: string }).decisionType).trim()
      : "";

  if (!dt || dt === "no_action") {
    return {
      allowed: true,
      explain: "Ingen operativ handling — kun observasjon.",
      requiresApproval: false,
      reasons: [],
    };
  }

  return {
    allowed: true,
    explain: "Forslag krever menneskelig gjennomgang før utførelse (enterprise policy).",
    requiresApproval: true,
    reasons: [],
  };
}
