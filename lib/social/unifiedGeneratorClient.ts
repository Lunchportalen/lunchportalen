/**
 * Klient-side inngang til én motor: POST `/api/social/ai/generate` (AI + deterministisk fallback på server).
 * Ingen duplikat av `generatePost` her — fail-closed tekst hvis nettverket feiler helt.
 */

import type { UnifiedSocialInput } from "@/lib/social/unifiedSocialTypes";

export type UnifiedGenerateClientResult = {
  text: string;
  hashtags: string[];
  platform: string;
  source: string;
  saved: boolean;
  savedId: string | null;
  images: string[];
  calendarPostId?: string;
  aiOk?: boolean;
  /** Satt ved total nettverks-/parse-feil (ingen DB-lagring). */
  clientFallback?: boolean;
};

const NETWORK_FALLBACK_TEXT =
  "Kunne ikke nå serveren for generering. Prøv igjen — deterministisk utkast leveres normalt fra API ved neste forsøk.";

/**
 * @param opts.input — kontekst (produkt, målgruppe, plattform, …). Tom objekt er gyldig (server bruker defaults).
 * @param opts.persist — lagre utkast i `social_posts` (default true).
 */
export async function generateUnifiedPost(opts: {
  mode?: "ai" | "deterministic";
  input?: Partial<UnifiedSocialInput>;
  persist?: boolean;
}): Promise<UnifiedGenerateClientResult> {
  const mode = opts.mode ?? "ai";
  const persist = opts.persist ?? true;
  const input = opts.input ?? {};

  try {
    const res = await fetch("/api/social/ai/generate", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        mode,
        persist,
        platform: input.platform ?? "linkedin",
        ...input,
      }),
      cache: "no-store",
    });

    const j = (await res.json()) as {
      ok?: boolean;
      data?: {
        text?: string;
        hashtags?: string[];
        platform?: string;
        source?: string;
        saved?: boolean;
        savedId?: string | null;
        images?: string[];
        calendarPostId?: string;
        aiOk?: boolean;
      };
    };

    const d = j?.data;
    if (res.ok && j?.ok === true && d && typeof d.text === "string") {
      return {
        text: d.text,
        hashtags: Array.isArray(d.hashtags) ? d.hashtags : [],
        platform: typeof d.platform === "string" ? d.platform : "linkedin",
        source: typeof d.source === "string" ? d.source : "deterministic",
        saved: Boolean(d.saved),
        savedId: typeof d.savedId === "string" ? d.savedId : null,
        images: Array.isArray(d.images) ? d.images : [],
        calendarPostId: typeof d.calendarPostId === "string" ? d.calendarPostId : undefined,
        aiOk: d.aiOk,
      };
    }
  } catch (err) {
    console.error("[AI_FAIL]", err);
  }

  return {
    text: NETWORK_FALLBACK_TEXT,
    hashtags: [],
    platform: typeof input.platform === "string" ? input.platform : "linkedin",
    source: "deterministic",
    saved: false,
    savedId: null,
    images: [],
    clientFallback: true,
  };
}
