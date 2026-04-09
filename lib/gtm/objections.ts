export type GtmObjectionType = "has_canteen" | "price" | "timing";

/**
 * Enkel regelbasert innvending (deterministisk). Produksjon: bruk sammen med {@link lib/outbound/objections} for kantine-fasit.
 */
export function detectObjection(text: string): GtmObjectionType | null {
  const t = String(text ?? "").toLowerCase().normalize("NFKC");
  if (t.includes("har kantine")) return "has_canteen";
  if (t.includes("for dyrt")) return "price";
  if (t.includes("ikke nå")) return "timing";
  return null;
}
