/**
 * Bransjespesifikk smerte/verdi og CTA — ingen generisk «én tekst til alle».
 */

import type { Industry } from "@/lib/ai/industry";

export type IndustryMessage = {
  pain: string;
  value: string;
};

export function getIndustryMessage(industry: Industry): IndustryMessage {
  switch (industry) {
    case "it":
      return {
        pain: "Folk hopper over lunsj eller bestiller tilfeldig.",
        value: "Sunn, fleksibel lunsj som passer moderne arbeidsplasser.",
      };
    case "construction":
      return {
        pain: "Ustabil lunsj og lite mat som metter på lange vakter.",
        value: "Solid, mettende lunsj levert direkte til arbeidsplassen.",
      };
    case "office":
      return {
        pain: "Tidsbruk på å organisere lunsj internt.",
        value: "Enkel lunsjordning uten ekstra administrasjon.",
      };
    case "healthcare":
      return {
        pain: "Skift, pasientflyt og tidspress gjør felles måltider vanskelig å planlegge.",
        value: "Forutsigbar, trygg mat til teamet — levert i tråd med arbeidsdagen.",
      };
    case "public":
      return {
        pain: "Mange avdelinger og faste rutiner — lunsj blir fort fragmentert.",
        value: "Én avtalt ordning som HR og økonomi kan eie — uten manuell koordinering.",
      };
    case "finance":
      return {
        pain: "Compliance og kostnadskontroll krever dokumenterbare avtaler — ikke ad hoc bestilling.",
        value: "Rammeverk for lunsj med forutsigbare kostnader og tydelig fakturagrunnlag.",
      };
    default: {
      const _exhaustive: never = industry;
      return _exhaustive;
    }
  }
}

/** Kort CTA-etikett (uten pil). */
export function getIndustryCTA(industry: Industry): "Book demo" | "Få tilbud" | "Se løsning" {
  switch (industry) {
    case "construction":
      return "Få tilbud";
    case "it":
      return "Se løsning";
    case "finance":
      return "Få tilbud";
    case "healthcare":
    case "public":
    case "office":
      return "Book demo";
    default: {
      const _exhaustive: never = industry;
      return _exhaustive;
    }
  }
}

/** Tillatte B2B CTA-linjer (med pil) — samme sett som B2B_CTA_LINES i b2bLeadMessaging. */
export function getIndustryB2bCtaLine(industry: Industry): "Book demo →" | "Få tilbud →" | "Se løsning →" {
  const label = getIndustryCTA(industry);
  if (label === "Få tilbud") return "Få tilbud →";
  if (label === "Se løsning") return "Se løsning →";
  return "Book demo →";
}

/** Frase til brødtekst (IT beholdes, ellers små bokstaver der det passer norsk). */
export function industryCopyPhrase(industry: Industry): string {
  switch (industry) {
    case "it":
      return "IT";
    case "construction":
      return "bygg";
    case "office":
      return "kontor";
    case "healthcare":
      return "helse";
    case "public":
      return "offentlig sektor";
    case "finance":
      return "finans";
    default: {
      const _exhaustive: never = industry;
      return _exhaustive;
    }
  }
}

/** Kort visningsnavn for UI (🏢 …). */
export function industryUiShortLabel(industry: Industry): string {
  switch (industry) {
    case "it":
      return "IT";
    case "construction":
      return "Bygg";
    case "office":
      return "Kontor";
    case "healthcare":
      return "Helse";
    case "public":
      return "Offentlig";
    case "finance":
      return "Finans";
    default: {
      const _exhaustive: never = industry;
      return _exhaustive;
    }
  }
}
