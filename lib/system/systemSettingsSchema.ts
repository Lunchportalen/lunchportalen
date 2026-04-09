// lib/system/systemSettingsSchema.ts
import { z } from "zod";

/**
 * Runtime validation for normalized `system_settings` rows (`withDefaults` output).
 * Used on the authoritative read path (`getSystemSettings`) — fail-closed on shape drift.
 */
export const systemSettingsOutputSchema = z.object({
  toggles: z.record(z.unknown()),
  killswitch: z.record(z.unknown()),
  retention: z.object({
    orders_months: z.number(),
    audit_years: z.number(),
  }),
  updated_at: z.union([z.string(), z.null()]),
  updated_by: z.union([z.string(), z.null()]),
});

export type SystemSettingsValidated = z.infer<typeof systemSettingsOutputSchema>;
