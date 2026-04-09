import type { OutboundLead } from "@/lib/outbound/lead";
import type { OutboundObjectionId } from "@/lib/outbound/objections";

export type HandleObjectionOptions = {
  /** Én pivot per lead — etter dette returneres null (ingen gjentatt tilbudspush). */
  pivotAlreadyUsed: boolean;
};

/**
 * Myk utgang + dør åpen. Returnerer null hvis pivot allerede er brukt (sikkerhet).
 */
export function handleObjection(
  type: OutboundObjectionId,
  lead: OutboundLead,
  options: HandleObjectionOptions,
): string | null {
  if (options.pivotAlreadyUsed) return null;

  if (type === "has_canteen") {
    const company = lead.companyName.trim() || "dere";
    return `Skjønner – da har ${company} allerede en løsning 👍

Mange av kundene våre har faktisk kantine selv, men bruker oss til:

• møtemat
• kaker
• catering

Kan være nyttig som supplement, spesielt på travle dager.

Hvis det ikke er aktuelt nå – helt fair 😊
men jeg kan gjerne sende deg noen eksempler du kan ha liggende.

Bare si ifra 👍`;
  }

  return null;
}

/** @deprecated Bruk HandleObjectionOptions */
export type HandleObjectionContext = HandleObjectionOptions;
