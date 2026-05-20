import { z } from "zod";

import { isValidNorwegianOrgnr } from "@/lib/orgnr/no";
import { isValidNoPhone, normalizeNoPhone } from "@/lib/phone/no";

export const providerRegistrationSchema = z.object({
  company_name: z.string().trim().min(1, "Bedriftsnavn er påkrevd."),
  org_number: z
    .string()
    .trim()
    .refine((v) => isValidNorwegianOrgnr(v), "Ugyldig organisasjonsnummer."),
  contact_name: z.string().trim().min(1, "Kontaktperson er påkrevd."),
  contact_email: z.string().trim().email("Ugyldig e-postadresse."),
  contact_phone: z
    .string()
    .trim()
    .refine((v) => isValidNoPhone(normalizeNoPhone(v)), "Telefon må være 8 siffer."),
  postal_code: z
    .string()
    .trim()
    .refine((v) => /^\d{4}$/.test(v.replace(/\D/g, "")), "Postnummer må være 4 siffer."),
  city: z.string().trim().min(1, "Poststed er påkrevd."),
  employees_estimate: z.coerce.number().int().min(20, "Minimum 20 ansatte."),
  notes: z.string().trim().max(2000).optional().default(""),
});

export type ProviderRegistrationInput = z.infer<typeof providerRegistrationSchema>;

export function toRegistrationRpcPayload(input: ProviderRegistrationInput) {
  return {
    company_name: input.company_name,
    org_number: input.org_number.replace(/\D/g, ""),
    contact_name: input.contact_name,
    contact_email: input.contact_email.toLowerCase(),
    contact_phone: normalizeNoPhone(input.contact_phone),
    postal_code: input.postal_code.replace(/\D/g, ""),
    city: input.city,
    employees_estimate: input.employees_estimate,
    notes: input.notes || null,
  };
}
