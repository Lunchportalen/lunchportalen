/**
 * Strict allowlist for company policy actions — unknown IDs / types default DENY.
 */

import { z } from "zod";

export const ALLOWED_COMPANY_ACTIONS = [
  "design.update",
  "design.scale",
  "revenue.optimize",
  "gtm.suggest",
  "content.suggest",
] as const;

/** Alias for product / API docs. */
export const AllowedActions = ALLOWED_COMPANY_ACTIONS;

export type AllowedCompanyAction = (typeof ALLOWED_COMPANY_ACTIONS)[number];

export const AllowedCompanyActionSchema = z.enum(ALLOWED_COMPANY_ACTIONS);

/** Canonical mapping from stable decision ids → allowlisted action (no guess). */
export const DECISION_ID_TO_ALLOWED_ACTION: Partial<Record<string, AllowedCompanyAction>> = {
  growth_cta_visibility: "revenue.optimize",
  product_spacing_readability: "design.update",
  product_relax_tight_spacing: "design.update",
  ops_review_draft_backlog: "content.suggest",
  ceo_content_health_review: "content.suggest",
};

export function resolveAllowedCompanyAction(d: {
  id: string;
  allowedAction?: AllowedCompanyAction | undefined;
}): AllowedCompanyAction | null {
  if (d.allowedAction) return d.allowedAction;
  return DECISION_ID_TO_ALLOWED_ACTION[d.id] ?? null;
}

const CompanyDecisionChannelSchema = z.enum([
  "design_optimizer",
  "revenue_insights",
  "cms_editor",
  "system_ops",
  "none",
]);

/** Validates shape before policy evaluation — fail-closed on malformed input. */
export const CompanyDecisionPolicyInputSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["ceo", "growth", "product", "operations"]),
    action: z.string().min(1),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1),
    risk: z.enum(["low", "medium", "high"]),
    channel: CompanyDecisionChannelSchema,
    allowedAction: AllowedCompanyActionSchema.optional(),
  })
  .strict();

export type CompanyDecisionPolicyInput = z.infer<typeof CompanyDecisionPolicyInputSchema>;
