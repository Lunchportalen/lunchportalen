/**
 * Barrel for input validation (Zod). API-ruter bør bruke eksplisitte skjemaer per rute.
 */
export { z } from "zod";

export {
  contactFormSchema,
  type ContactFormInput,
} from "@/lib/validation/schemas";
