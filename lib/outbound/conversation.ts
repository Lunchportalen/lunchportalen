import type { OutboundObjectionId } from "@/lib/outbound/objections";

export type ConversationState = "lunch_pitch" | "catering_pitch" | "closed";

/**
 * Neste tilstand ut fra innvending. Ukjent innvending → uendret.
 */
export function nextState(current: ConversationState, objection: OutboundObjectionId | null): ConversationState {
  if (objection === "has_canteen") {
    return "catering_pitch";
  }
  return current;
}
