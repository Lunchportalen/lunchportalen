import { z } from "zod";

/**
 * Kontaktskjema — avvis ugyldig input med 400 (valider før forretningslogikk).
 * `postId` er tekst-ID (SoMe), ikke nødvendigvis UUID.
 */
export const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Navn mangler.").max(140, "Navn er for langt."),
  email: z.string().trim().email("Ugyldig e-postadresse.").max(200, "E-post er for lang."),
  company: z.union([z.string().max(200), z.null()]).optional(),
  phone: z.union([z.string().max(40), z.null()]).optional(),
  subject: z.string().trim().min(1, "Emne mangler.").max(180, "Emne er for langt."),
  message: z.string().trim().min(1, "Melding mangler.").max(5000, "Meldingen er for lang."),
  postId: z.string().trim().max(128).optional(),
  /** Alias for postId (legacy clients). */
  post_id: z.string().trim().max(128).optional(),
  rid: z.string().max(200).optional(),
  website: z.string().optional(),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

/** Employee order write body (RPC `lp_order_set`). */
export const orderWriteBodySchema = z
  .object({
    date: z.string().optional(),
    action: z.string().optional(),
    note: z.union([z.string(), z.null()]).optional(),
    slot: z.union([z.string(), z.null()]).optional(),
    attribution: z.unknown().optional(),
    mvo: z
      .object({
        variant_channel: z.string().max(64).optional(),
        variant_segment: z.string().max(64).optional(),
        variant_timing: z.string().max(64).optional(),
        market_id: z.string().max(64).optional(),
      })
      .optional(),
  })
  .passthrough();

export type OrderWriteBodyInput = z.infer<typeof orderWriteBodySchema>;

const mappedActionEnum = z.enum(["adjust_sequence", "update_copy", "retry_jobs", "observe"]);

export const autonomyRunBodySchema = z
  .object({
    windowDays: z.number().finite().optional(),
    forceDryRun: z.boolean().optional(),
    approvedActionTypes: z.array(mappedActionEnum).optional(),
    growth: z
      .object({
        pageId: z.string().min(1),
        companyId: z.string().min(1),
        userId: z.string().optional(),
        locale: z.string().optional(),
        postMetrics: z
          .object({
            clicks: z.number().finite(),
            orders: z.number().finite(),
            revenue: z.number().finite(),
          })
          .optional(),
      })
      .optional(),
  })
  .passthrough();

export const autonomyRevenueBodySchema = z
  .object({
    dryRun: z.boolean().optional(),
    companyId: z.string().optional(),
    userId: z.string().optional(),
  })
  .passthrough();

export const superadminAutonomyConfigBodySchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.enum(["dry-run", "semi", "auto"]).optional(),
  })
  .passthrough();

export const socialPostsSaveBodySchema = z
  .object({
    posts: z.array(z.unknown()),
    variantGroupId: z.string().optional(),
    variant_group_id: z.string().optional(),
  })
  .passthrough();

export const socialAiGenerateBodySchema = z
  .object({
    mode: z.enum(["deterministic", "ai"]).optional(),
    persist: z.boolean().optional(),
    product: z.string().optional(),
    audience: z.string().optional(),
    goal: z.string().optional(),
    productId: z.string().optional(),
    slotDay: z.string().optional(),
    platform: z.string().optional(),
    calendarPostId: z.string().optional(),
  })
  .passthrough();

/** CMS social calendar — enkelt innlegg (PATCH). */
export const socialPostPatchBodySchema = z
  .object({
    status: z.string().min(1).optional(),
    scheduled_at: z.string().nullable().optional(),
    scheduledAt: z.union([z.string(), z.number()]).nullable().optional(),
    platform: z.string().max(32).optional(),
    caption: z.string().max(20000).optional(),
    text: z.string().max(20000).optional(),
    hashtags: z.array(z.string().max(120)).max(80).optional(),
    imageUrl: z.union([z.string().max(2000), z.null()]).optional(),
    slotDay: z.string().max(32).optional(),
  })
  .passthrough();

export const socialPostPublishBodySchema = z.object({
  id: z.string().min(1).max(200),
});
