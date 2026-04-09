/**
 * Strukturerte, valgfrie Zod-skjemaer for JSONB / rader (validering før skriving — additive).
 * Erstatter ikke DB-constraints; brukes der kallpunkt trenger fail-closed validering.
 */
import { z } from "zod";

/** SoMe / CMS-innhold (forenklet — utvid ved behov). */
export const socialPostContentSchema = z
  .object({
    version: z.number().optional(),
    text: z.string().optional(),
    metrics: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const leadPipelineMetaSchema = z.record(z.string(), z.unknown());

/** Ordre — felter som ofte leses i aggregeringer (ikke full tabell). */
export const orderAggregateRowSchema = z.object({
  id: z.string().uuid().optional(),
  line_total: z.union([z.number(), z.string()]).optional(),
  social_post_id: z.string().nullable().optional(),
  company_id: z.string().uuid().optional(),
  attribution: z.unknown().optional(),
});

export type SocialPostContentParsed = z.infer<typeof socialPostContentSchema>;
