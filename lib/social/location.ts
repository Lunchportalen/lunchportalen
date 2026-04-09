/**
 * Fast geografisk mål for SoMe / vekst (B2B lunsj).
 * Publisert verdi kommer fra CMS (`global_content.settings.data.social.location`).
 * Standard: Trondheim.
 */

export type Location = "trondheim" | "oslo" | "tromso" | "stockholm";

export const defaultSocialLocation: Location = "trondheim";

/**
 * Kjør kun etter vellykket lesing fra CMS (eller eksplisitt brukervalg i backoffice).
 * Ikke sett fra tilfeldige kilder.
 */
export const socialConfig: { location: Location } = {
  location: defaultSocialLocation,
};

export function setSocialConfigLocation(loc: Location): void {
  socialConfig.location = loc;
}

export function normalizeSocialLocation(raw: unknown): Location {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "trondheim") return "trondheim";
  if (s === "oslo") return "oslo";
  if (s === "tromso" || s === "tromsø") return "tromso";
  if (s === "stockholm") return "stockholm";
  return defaultSocialLocation;
}

export function locationLabel(loc: Location): string {
  if (loc === "tromso") return "Tromsø";
  if (loc === "trondheim") return "Trondheim";
  if (loc === "oslo") return "Oslo";
  return "Stockholm";
}

/** Les `social.location` fra publisert CMS settings-objekt. */
export function parseSocialLocationFromCmsData(data: Record<string, unknown> | null | undefined): Location {
  if (!data || typeof data !== "object") return defaultSocialLocation;
  const social = data.social;
  if (!social || typeof social !== "object" || Array.isArray(social)) return defaultSocialLocation;
  const loc = (social as Record<string, unknown>).location;
  return normalizeSocialLocation(loc);
}
