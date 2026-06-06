import { z } from "zod";

/** F5 — dropdown bands (Umbraco «employees»-felt, lagres som tekst i company_size). */
export const DEMO_COMPANY_SIZE_OPTIONS = [
  { value: "1-10", label: "1–10 ansatte" },
  { value: "11-50", label: "11–50 ansatte" },
  { value: "51-200", label: "51–200 ansatte" },
  { value: "201-500", label: "201–500 ansatte" },
  { value: "500+", label: "500+ ansatte" },
] as const;

const companySizeValues = DEMO_COMPANY_SIZE_OPTIONS.map((o) => o.value) as [
  (typeof DEMO_COMPANY_SIZE_OPTIONS)[number]["value"],
  ...(typeof DEMO_COMPANY_SIZE_OPTIONS)[number]["value"][],
];

function emptyToUndefined(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

export const leadsCaptureBodySchema = z.object({
  name: z.string().trim().min(1, "Navn er påkrevd").max(200, "Navn er for langt"),
  email: z.string().trim().email("Ugyldig e-postadresse").max(254, "E-post er for lang"),
  company: z.string().trim().min(1, "Bedrift er påkrevd").max(300, "Bedriftsnavn er for langt"),
  source: z.string().trim().min(1).max(128),
  consented: z.literal(true, {
    errorMap: () => ({ message: "Du må samtykke for å sende inn." }),
  }),
  phone: z.preprocess(emptyToUndefined, z.string().min(8, "Telefon må ha minst 8 tegn").max(32).optional()),
  company_size: z.preprocess(
    emptyToUndefined,
    z.enum(companySizeValues, { errorMap: () => ({ message: "Ugyldig antall ansatte" }) }).optional(),
  ),
  message: z.preprocess(emptyToUndefined, z.string().max(4000, "Meldingen er for lang").optional()),
  website: z.string().optional(),
});

export type LeadsCaptureBody = z.infer<typeof leadsCaptureBodySchema>;
