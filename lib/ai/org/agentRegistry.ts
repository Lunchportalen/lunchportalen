/**
 * Multi-agent org layer — stable role ids for logging / memory (no runtime magic strings scattered).
 */

export const AGENTS = {
  CEO: "ceo",
  GROWTH: "growth",
  PRODUCT: "product",
  OPERATIONS: "operations",
} as const;

export type AgentRoleId = (typeof AGENTS)[keyof typeof AGENTS];
