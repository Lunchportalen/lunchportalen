"use client";

import { createContext, useContext } from "react";

/** Mål for deferred hint-portaler på content-detail (under faktiske felter, ikke under blokk-banner). */
export const InspectorDeferredHintSlotContext = createContext<HTMLDivElement | null>(null);

export function useInspectorDeferredHintSlot(): HTMLDivElement | null {
  return useContext(InspectorDeferredHintSlotContext);
}
