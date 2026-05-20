import { z } from "zod";

const weekdayEnum = z.enum(["mon", "tue", "wed", "thu", "fri"]);

export const serviceAreaFormSchema = z
  .object({
    city: z.string().trim().min(1, "Poststed er påkrevd."),
    postal_code_from: z
      .string()
      .trim()
      .refine((v) => /^\d{4}$/.test(v.replace(/\D/g, "")), "Fra-postnummer må være 4 siffer."),
    postal_code_to: z
      .string()
      .trim()
      .refine((v) => /^\d{4}$/.test(v.replace(/\D/g, "")), "Til-postnummer må være 4 siffer."),
    min_employees: z.coerce.number().int().min(1).optional().nullable(),
    max_employees: z.coerce.number().int().min(1).optional().nullable(),
    available_days: z.array(weekdayEnum).min(1, "Velg minst én dag."),
    active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const from = data.postal_code_from.replace(/\D/g, "");
    const to = data.postal_code_to.replace(/\D/g, "");
    if (from > to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fra-postnummer kan ikke være høyere enn til-postnummer.",
        path: ["postal_code_to"],
      });
    }
    if (
      data.min_employees != null &&
      data.max_employees != null &&
      data.min_employees > data.max_employees
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Min ansatte kan ikke være høyere enn maks.",
        path: ["max_employees"],
      });
    }
  });

export type ServiceAreaFormInput = z.infer<typeof serviceAreaFormSchema>;

export function normalizePostal(v: string) {
  return v.replace(/\D/g, "").slice(0, 4);
}
