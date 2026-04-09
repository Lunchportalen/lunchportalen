/**
 * Regelbasert innvendingsdeteksjon (forklarbar, ingen skjult ML).
 */

export type OutboundObjectionId = "has_canteen";

export function detectObjection(text: string): OutboundObjectionId | null {
  const t = text.toLowerCase().normalize("NFKC");

  const hasCanteen =
    t.includes("kantine") ||
    t.includes("har allerede lunsj") ||
    t.includes("allerede lunsj") ||
    t.includes("egen løsning") ||
    t.includes("får lunsj") ||
    t.includes("bedriftskantine") ||
    t.includes("serveres på jobben") ||
    t.includes("mat på jobben") ||
    t.includes("trenger ikke lunsj") ||
    t.includes("har matordning");

  if (hasCanteen) return "has_canteen";

  return null;
}
