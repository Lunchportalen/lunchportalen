/**
 * STEP 11 — Kontrollert automatisering: kun påminnelser og forslag — aldri automatisk utsending.
 */

import type { GtmLead } from "./types";

export type GtmSuggestedAction = {
  leadId: string;
  title: string;
  reason: string;
  /** Bruker må selv utføre (e-post, oppringing, osv.) */
  channelHint: "email" | "linkedin" | "note";
};

const MS_DAY = 86_400_000;

function lastInteractionAt(lead: GtmLead): number {
  if (lead.interactions.length === 0) return 0;
  const last = lead.interactions[lead.interactions.length - 1];
  const t = Date.parse(last.at);
  return Number.isFinite(t) ? t : 0;
}

export function suggestControlledNextActions(leads: GtmLead[], now = Date.now()): GtmSuggestedAction[] {
  const out: GtmSuggestedAction[] = [];

  for (const l of leads) {
    const last = lastInteractionAt(l);
    const stale = last > 0 && now - last > 7 * MS_DAY;

    if (l.status === "new" && l.score >= 50) {
      out.push({
        leadId: l.id,
        title: "Start kontrollert første kontakt",
        reason: `Score ${l.score}: forbered utkast (e-post/LinkedIn) og godkjenn manuelt.`,
        channelHint: l.contact.email ? "email" : "linkedin",
      });
    }

    if (l.status === "contacted" && stale) {
      out.push({
        leadId: l.id,
        title: "Oppfølgingspåminnelse (ingen auto-send)",
        reason: "Siste kontakt > 7 dager — vurder én oppfølging med ny vinkel.",
        channelHint: "email",
      });
    }

    if (l.status === "interested") {
      out.push({
        leadId: l.id,
        title: "Book møte / neste steg",
        reason: "Interesse registrert — flytt mot møte eller tilbud (logg i CRM).",
        channelHint: "note",
      });
    }
  }

  return out.slice(0, 15);
}
