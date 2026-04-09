import type { GtmLeadMessageInput } from "@/lib/gtm/outboundTemplates";

export type GtmReplyClassification =
  | { kind: "objection"; objectionId: "has_canteen"; confidence: number }
  | { kind: "interest"; confidence: number }
  | { kind: "neutral"; confidence: number };

/**
 * Klassifiserer innlimt svar (deterministisk, norsk-først).
 */
export function classifyGtmReply(text: string): GtmReplyClassification {
  const t = String(text ?? "").toLowerCase().normalize("NFKC");
  const hasCanteen =
    t.includes("kantine") ||
    t.includes("har allerede lunsj") ||
    t.includes("bedriftskantine") ||
    t.includes("egen løsning");
  if (hasCanteen) {
    return { kind: "objection", objectionId: "has_canteen", confidence: 0.86 };
  }
  const interest =
    t.includes("prat") ||
    t.includes("interessert") ||
    t.includes("demo") ||
    t.includes("møte") ||
    t.includes("kult");
  if (interest) {
    return { kind: "interest", confidence: 0.78 };
  }
  return { kind: "neutral", confidence: 0.42 };
}

export function respondToObjection(type: string, _lead: GtmLeadMessageInput): string | null {
  void _lead;
  if (type === "has_canteen") {
    return `Mange av våre kunder hadde kantine før – men gikk over for å redusere kostnader og øke fleksibilitet.`;
  }
  if (type === "price") {
    return `De fleste opplever faktisk lavere total kostnad når man inkluderer svinn og drift.`;
  }
  if (type === "timing") {
    return `Skjønner – hva med en kort prat neste uke?`;
  }
  return null;
}
