// lib/public/providerRegistrationSchema.ts
// Zod contract for public provider (cateringfirma) self-service registration.
// Country must be one of the 21 canonical markets; US/CA require a timezone
// (provider_required markets). Fail-closed — server RPC re-validates + dedups.
import { z } from "zod";

import {
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_LANGUAGES,
  getMarketCountry,
} from "@/lib/markets/supportedMarkets";

const country = z.enum(SUPPORTED_COUNTRY_CODES as unknown as [string, ...string[]]);
const language = z.enum(SUPPORTED_LANGUAGES as unknown as [string, ...string[]]);

export const providerRegistrationSchema = z
  .object({
    company_name: z.string().trim().min(2).max(200),
    org_number: z.string().trim().min(4).max(40).optional().or(z.literal("")),
    country_code: country,
    contact_name: z.string().trim().min(2).max(160),
    contact_email: z.string().trim().email().max(200),
    contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
    operating_language: language,
    invoice_language: language,
    currency: z.string().trim().length(3),
    timezone: z.string().trim().max(64).optional().or(z.literal("")),
    tax_registration: z.string().trim().max(80).optional().or(z.literal("")),
    order_email: z.string().trim().email().max(200).optional().or(z.literal("")),
    kitchen_email: z.string().trim().email().max(200).optional().or(z.literal("")),
    delivery_email: z.string().trim().email().max(200).optional().or(z.literal("")),
    coverage_wish: z.string().trim().max(2000).optional().or(z.literal("")),
    cutoff_local_time: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/)
      .optional()
      .or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    const market = getMarketCountry(val.country_code);
    if (market && market.timezoneStrategy === "provider_required" && !val.timezone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timezone"],
        message: "TIMEZONE_REQUIRED_FOR_MARKET",
      });
    }
  });

export type ProviderRegistrationInput = z.infer<typeof providerRegistrationSchema>;
