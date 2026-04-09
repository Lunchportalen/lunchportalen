import "server-only";

/**
 * Integration feature flags (additive). All default off / safe until explicitly enabled in env.
 *
 * Env (document for operators):
 * - ADS_ENABLED=true
 * - EMAIL_ENABLED=true
 * - TRIPLETEX_ENABLED=true
 * - TRIPLETEX_TOKEN or TRIPLETEX_SESSION_TOKEN (+ TRIPLETEX_COMPANY_ID; optional consumer/employee session flow — see lib/integrations/tripletex/client.ts)
 * - TRIPLETEX_REVENUE_DEFAULT_CUSTOMER_ID, TRIPLETEX_REVENUE_DEFAULT_PRODUCT_ID, TRIPLETEX_REVENUE_DEFAULT_VAT_CODE (numeric VAT type id) for revenue → invoice path
 */
export const INTEGRATIONS = {
  ads: {
    enabled: process.env.ADS_ENABLED === "true",
  },
  email: {
    enabled: process.env.EMAIL_ENABLED === "true",
  },
  crm: {
    enabled: true,
  },
  tripletex: {
    enabled: process.env.TRIPLETEX_ENABLED === "true",
  },
} as const;
