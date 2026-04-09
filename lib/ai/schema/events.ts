/**
 * Canonical intelligence event envelope (read model + API contract).
 */

import { z } from "zod";

/** Stored / API intelligence `event_type` (canonical domain bucket for new rows). */
export const INTELLIGENCE_DOMAIN_TYPES = [
  "analytics",
  "conversion",
  "design_change",
  "gtm",
  "experiment",
] as const;

export type IntelligenceDomainType = (typeof INTELLIGENCE_DOMAIN_TYPES)[number];

export const IntelligenceDomainTypeSchema = z.enum(INTELLIGENCE_DOMAIN_TYPES);

/** Full persisted / API intelligence row (after insert or from DB). */
export const IntelligenceEventSchema = z
  .object({
    id: z.string().min(1),
    type: IntelligenceDomainTypeSchema,
    source: z.string().min(1),
    timestamp: z.number(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export type IntelligenceEventValidated = z.infer<typeof IntelligenceEventSchema>;

/** Ingestion shape (no server-generated id / created_at yet). */
export const LogEventInputSchema = z
  .object({
    type: IntelligenceDomainTypeSchema,
    source: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
    page_id: z.string().nullable().optional(),
    company_id: z.string().nullable().optional(),
    source_rid: z.string().nullable().optional(),
  })
  .strict();

export type LogEventInputValidated = z.infer<typeof LogEventInputSchema>;
