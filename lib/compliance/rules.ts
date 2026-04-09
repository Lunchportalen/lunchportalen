/**
 * Compliance toggles for enterprise workflows (policy flags, not enforcement alone).
 */

export const complianceRules = {
  requireApprovalForSpend: true,
  requireApprovalForPricing: true,

  logAllAIActions: true,

  maxRetentionDays: 365,
} as const;

export type ComplianceRules = typeof complianceRules;
