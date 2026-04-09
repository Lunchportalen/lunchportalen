/**
 * Sosial publisering — fail-closed, ingen skjulte kall.
 * Denne bygget kjører kun dry-run med mindre eksplisitt bekreftelse + (senere) API-nøkler.
 */

import { validateB2bLeadContent } from "@/lib/social/b2bContentGate";

export type PublishSocialVia = "manual_approve" | "auto_safe";

export type PublishSocialInput = {
  caption: string;
  hashtags: string[];
  platforms: readonly string[];
  productId: string;
  productName: string;
  via: PublishSocialVia;
  /** Påkrevd for manuell vei — satt etter godkjenningsmodal */
  explicitUserConfirmed?: boolean;
};

export type PublishSocialResult = {
  ok: boolean;
  simulated: boolean;
  rid: string;
  message: string;
  postedAt: string;
};

function makeRid(): string {
  return `pub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Utfør publisering (eller dry-run). Kall KUN etter regel-sjekk og bruker-godkjenning / auto-modus.
 */
export async function publishSocialPost(input: PublishSocialInput): Promise<PublishSocialResult> {
  const rid = makeRid();
  const postedAt = new Date().toISOString();

  if (input.via === "manual_approve" && input.explicitUserConfirmed !== true) {
    return {
      ok: false,
      simulated: true,
      rid,
      message: "Stoppet: mangler eksplisitt bekreftelse i UI.",
      postedAt,
    };
  }

  const composite = `${input.caption}\n${input.hashtags.join(" ")}`;
  const gate = validateB2bLeadContent(composite);
  if (gate.ok === false) {
    return {
      ok: false,
      simulated: true,
      rid,
      message: `B2B lead-filter: ${gate.reasons.join(" ")}`,
      postedAt,
    };
  }

  // Standard: transparent dry-run (ingen ekstern API i denne klient-/lib-stien).
  return {
    ok: true,
    simulated: true,
    rid,
    message:
      input.via === "auto_safe"
        ? "Auto (trygg): dry-run fullført. Ingen ekte utsending før API er koblet og godkjent i drift."
        : "Dry-run OK. Ingen ekte utsending — koble Meta m.fl. via sikker serverflyt når klar.",
    postedAt,
  };
}
