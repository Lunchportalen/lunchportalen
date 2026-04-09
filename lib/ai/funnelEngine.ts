/**
 * Funnel structure + improvement hints from content shape and optional analytics.
 * Suggest-only; does not change CMS or tracking config.
 */

export type FunnelContent = {
  title?: string;
  primaryCta?: string;
  blockTypes?: string[];
  hasHero?: boolean;
  hasLeadForm?: boolean;
};

export type FunnelAnalytics = {
  steps?: Array<{ name: string; users?: number; rate?: number }>;
  bounced?: number;
  converted?: number;
};

export type FunnelStep = {
  type: "landing" | "content" | "cta" | "trust" | "email" | "retarget";
  label: string;
  purpose: string;
};

export type FunnelEngineResult = {
  steps: FunnelStep[];
  improvements: string[];
};

export function buildFunnel(content: FunnelContent, insights: FunnelAnalytics): FunnelEngineResult {
  const improvements: string[] = [];
  const steps: FunnelStep[] = [];

  steps.push({
    type: "landing",
    label: "Landing / hero",
    purpose: "Tydelig verdiforslag og én primær handling — matcher annonse og søkeintensjon.",
  });

  if (content.hasHero === false) {
    improvements.push("Legg til hero øverst med én primær CTA som gjentas senere på siden.");
  }

  steps.push({
    type: "content",
    label: "Bevis og utdyping",
    purpose: "Korte avsnitt, underoverskrifter, gjerne case eller tall — bygger tillit før CTA.",
  });

  const types = content.blockTypes ?? [];
  if (!types.includes("richText") && !types.includes("cta")) {
    improvements.push("Mellom landing og hard CTA: minst én tekstblokk som svarer på «hvorfor nå?».");
  }

  steps.push({
    type: "trust",
    label: "Tillit",
    purpose: "Logoer, sitater, sertifisering eller ESG-punkt — reduser friksjon før konvertering.",
  });

  steps.push({
    type: "cta",
    label: "Konvertering",
    purpose: "Én tydelig knapp (demo / kontakt). Unngå konkurrerende like sterke CTA-er.",
  });

  if (content.hasLeadForm) {
    steps.push({
      type: "email",
      label: "Oppfølging",
      purpose: "E-postserie med case + FAQ — hold samme tone som annonsen.",
    });
  } else {
    improvements.push("Vurder lett lead-magnet (sjekkliste PDF) for å heve topp-of-funnel konvertering.");
  }

  const funnelSteps = insights.steps ?? [];
  for (let i = 0; i < funnelSteps.length - 1; i++) {
    const a = funnelSteps[i];
    const b = funnelSteps[i + 1];
    const rA = typeof a.rate === "number" ? a.rate : null;
    const rB = typeof b.rate === "number" ? b.rate : null;
    if (rA != null && rB != null && rA > 0 && rB < rA * 0.35) {
      improvements.push(
        `Stort fall mellom «${a.name}» og «${b.name}» — forenkle neste steg eller reduser felt i skjema.`,
      );
    }
  }

  if (typeof insights.bounced === "number" && insights.bounced > 0.55) {
    improvements.push("Høy bounce: sjekk hastighet, mobil H1 synlig over fold, og relevans mot trafikkilde.");
  }

  if (typeof insights.converted === "number" && insights.converted < 0.02) {
    improvements.push("Lav konvertering: test én endring om gangen (CTA-tekst, sosial proof, skjemalengde).");
  }

  if (!content.primaryCta) {
    improvements.push("Definer eksplisitt primær-CTA (verb + outcome), og gjenta den etter bevis-seksjon.");
  }

  steps.push({
    type: "retarget",
    label: "Retarget (valgfritt)",
    purpose: "Korte påminnelser på Meta/Google — samme budskap som første landing, ikke nye løfter.",
  });

  return { steps, improvements: Array.from(new Set(improvements)) };
}
