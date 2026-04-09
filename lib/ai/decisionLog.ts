/**
 * Lokal beslutningslogg for AI CEO-panelet (transparent, reversibel i betydningen «kan ignoreres»).
 * Valgfri persistens senere — ikke database i denne leveransen.
 */

export type DecisionKind = "strategy_intent" | "social_post" | "social_schedule" | "social_ignore" | "other";

export type SocialPostLog = {
  productId: string;
  productName?: string;
  platforms: string[];
  captionSnippet: string;
  via: "manual_approve" | "auto_safe";
  simulated: boolean;
  rid?: string;
};

export type Decision = {
  id: string;
  action: string;
  approved: boolean;
  timestamp: number;
  /** Ekstra kontekst, f.eks. anbefalingens tittel */
  context?: string;
  decisionType?: DecisionKind;
  socialPost?: SocialPostLog;
};

const decisions: Decision[] = [];
let seq = 0;

function nextId(): string {
  seq += 1;
  return `dec_${seq}_${Date.now().toString(36)}`;
}

export function logDecision(entry: Omit<Decision, "id" | "timestamp"> & { id?: string; timestamp?: number }): string {
  const id = entry.id ?? nextId();
  decisions.push({
    id,
    action: entry.action,
    approved: entry.approved,
    timestamp: entry.timestamp ?? Date.now(),
    context: entry.context,
  });
  return id;
}

export function getDecisions(): Decision[] {
  return [...decisions].sort((a, b) => b.timestamp - a.timestamp);
}

export function clearDecisionLog(): void {
  decisions.length = 0;
}
