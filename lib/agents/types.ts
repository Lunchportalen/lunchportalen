/** Kjente agenter i orkestreringen (utvid kun additivt). */
export const AGENTS = ["ceo", "growth", "sales", "content"] as const;

export type AgentId = (typeof AGENTS)[number];
