import { z } from "zod";

import { isValidCity, isValidPostalCode, normalizeCity, normalizePostalCode } from "@/lib/public/geographyParams";

export const coverageCheckBodySchema = z.object({
  postal_code: z
    .string()
    .trim()
    .transform(normalizePostalCode)
    .refine(isValidPostalCode, "Postnummer må være 4 siffer"),
  city: z
    .string()
    .trim()
    .transform(normalizeCity)
    .refine(isValidCity, "Poststed må fylles ut"),
});

export type CoverageCheckBody = z.infer<typeof coverageCheckBodySchema>;
