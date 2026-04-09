/**
 * B2B lead-generering: beslutningstakere, 20–200 ansatte, konvertering før «likes».
 * Deterministisk rotasjon (40 % problem/løsning, 30 % demo/produkt, 30 % bevis/effekt).
 */

import type { Industry } from "@/lib/ai/industry";
import { detectIndustry } from "@/lib/ai/industry";
import type { Role } from "@/lib/ai/role";
import { detectRole } from "@/lib/ai/role";
import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import { appendRevenuePostIdToAbsoluteUrl } from "@/lib/revenue/attribution";
import { appendLeadSourceToUrl } from "@/lib/social/leadSource";
import { getIndustryRoleIntro } from "@/lib/social/industryRoleMessaging";
import {
  getIndustryB2bCtaLine,
  getIndustryMessage,
  industryCopyPhrase,
} from "@/lib/social/industryMessaging";
import type { Location } from "@/lib/social/location";

export type B2bArchetype = "problem" | "solution" | "demo" | "proof" | "efficiency";

export type B2bValuePillar = "tid" | "hverdag" | "miljo" | "kostnad";

/** Tillatte CTA-linjer — aldri «kjøp nå» / «bestill mat». */
export const B2B_CTA_LINES = ["Book demo →", "Få tilbud →", "Se løsning →"] as const;
export type B2bCtaLine = (typeof B2B_CTA_LINES)[number];

function seedNum(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Ukentlig miks: 40 % problem/løsning, 30 % demo/produkt, 30 % bevis/verdi.
 */
export function pickB2bArchetype(rotationSeed: string): B2bArchetype {
  const n = seedNum(rotationSeed) % 10;
  if (n < 4) return n % 2 === 0 ? "problem" : "solution";
  if (n < 7) return "demo";
  return n < 9 ? "proof" : "efficiency";
}

export function pickB2bValuePillar(rotationSeed: string): B2bValuePillar {
  const pillars: B2bValuePillar[] = ["tid", "hverdag", "miljo", "kostnad"];
  return pillars[seedNum(rotationSeed + "p") % pillars.length]!;
}

export function pickB2bCta(rotationSeed: string): B2bCtaLine {
  return B2B_CTA_LINES[seedNum(rotationSeed + "c") % B2B_CTA_LINES.length]!;
}

const PILLAR_LINE: Record<B2bValuePillar, string> = {
  tid: "Dere sparer tid – mindre administrasjon rundt lunsj for kontoret.",
  hverdag: "En enklere hverdag for bedriften: ett tydelig spor for lunsjordningen.",
  miljo: "Bedre arbeidsmiljø når teamet slipper å koordinere hvem som ordner mat.",
  kostnad: "Forutsigbar kostnad – avtalte rammer som finance og HR kan forholde seg til.",
};

const SIZE_LINE = "Perfekt for bedrifter med 20–200 ansatte som vil ha kontroll uten ekstra interne ressurser.";

export type B2bLeadPostCopy = {
  hook: string;
  caption: string;
  text: string;
  archetype: B2bArchetype;
  valuePillar: B2bValuePillar;
  cta: B2bCtaLine;
  industry: Industry;
  targetRole: Role;
};

/**
 * Bygger komplett SoMe-tekst + strukturert hook/caption for kalender.
 * @param leadSourceId — når satt, legges `?src=` på lenken for attributjon.
 * @param industry — når utelatt, detekteres deterministisk fra produktnavn/URL (fallback «office»).
 * @param targetRole — når utelatt, detekteres fra produktnavn/URL (fallback «office»).
 * @param revenuePostId — når satt, legges `postId=` på absolutt URL (bevarer eksisterende ?src=).
 */
export function buildB2bLeadPostCopy(
  product: SocialProductRef,
  _location: Location,
  rotationSeed: string,
  leadSourceId?: string,
  industry?: Industry,
  targetRole?: Role,
  revenuePostId?: string,
): B2bLeadPostCopy {
  const rawUrl = String(product.url ?? "").trim() || "#";
  let url = leadSourceId ? appendLeadSourceToUrl(rawUrl, leadSourceId) : rawUrl;
  if (revenuePostId) {
    url = appendRevenuePostIdToAbsoluteUrl(url, revenuePostId);
  }
  const productCtx = `${product.name} ${product.url}`;
  const ind = industry ?? detectIndustry(productCtx);
  const rol = targetRole ?? detectRole(productCtx);
  const msg = getIndustryMessage(ind);
  const phrase = industryCopyPhrase(ind);
  const archetype = pickB2bArchetype(rotationSeed);
  const valuePillar = pickB2bValuePillar(rotationSeed + archetype);
  const cta = getIndustryB2bCtaLine(ind) as B2bCtaLine;
  const pillarLine = PILLAR_LINE[valuePillar];

  let hook: string;
  let body: string;

  switch (archetype) {
    case "problem":
      hook = msg.pain.length > 88 ? `${msg.pain.slice(0, 85)}…` : msg.pain;
      body = `${msg.value}

${pillarLine}

${SIZE_LINE}`;
      break;
    case "solution":
      hook = msg.value.length > 88 ? `${msg.value.slice(0, 85)}…` : msg.value;
      body = `${msg.pain}

${pillarLine}

${SIZE_LINE}`;
      break;
    case "demo":
      hook = `Lunsjordning tilpasset ${phrase}`;
      body = `${msg.pain}

${msg.value}

${pillarLine}

${SIZE_LINE}`;
      break;
    case "proof":
      hook = `Forutsigbar lunsj i ${phrase}`;
      body = `Beslutningstakere i ${phrase} trenger avtaler som er enkle å forsvare internt — ikke ad hoc bestilling.

${pillarLine}

${SIZE_LINE}`;
      break;
    case "efficiency":
      hook = `Mindre koordinering — mer kjernevirksomhet (${phrase})`;
      body = `${msg.pain}

${msg.value}

${pillarLine}

${SIZE_LINE}`;
      break;
  }

  const intro = getIndustryRoleIntro(ind, rol);
  body = `${intro}

${body}`;

  const caption = `${hook}

${body}

${cta} ${url}`;

  const text = `🥗 ${hook}

${body}

${cta} ${url}`;

  return { hook, caption, text, archetype, valuePillar, cta, industry: ind, targetRole: rol };
}
