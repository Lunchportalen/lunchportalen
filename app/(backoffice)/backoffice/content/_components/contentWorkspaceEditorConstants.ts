/**
 * Editor-/demo-konstanter for ContentWorkspace — ingen hooks, ingen domene-API.
 */

import { normalizeBlock } from "./contentWorkspace.blocks";
import type { Block } from "./editorBlockTypes";

export const IMAGE_PRESETS = {
  office: "Sosial lunsj i moderne kontorlandskap",
  buffet: "Delikat buffet med variert utvalg av lunsjretter",
  meeting: "Lunsj servert i møterom med ansatte rundt bord",
  closeup: "Nærbilde av premium mat og råvarer",
} as const;

export const LUNCHPORTALEN_STYLE = `
moderne nordisk kontormiljø,
naturlig dagslys (mykt og diffust),
lyse rom med tre, tekstil og minimalistisk design,
ekte mennesker (ikke modellaktige),
naturlige bevegelser og samtaler,
delikat, realistisk mat (ikke overstylet),
varm og rolig stemning,
fotorealistisk, høy kvalitet,
ingen harde kontraster,
ingen overmettet farger,
ingen stockfoto-look
`;

export const LUNCHPORTALEN_NEGATIVE = `
unngå: stockfoto, kunstig lys, studiooppsett,
perfekte modeller, overdreven styling,
plastisk mat, unaturlige farger,
hard skygge, dramatisk lys
`;

export const LUNCHPORTALEN_STYLE_SEED = "lunchportalen-v1";

export const ONBOARDING_DONE_KEY = "lp_onboarding_done";

const heroDemo = normalizeBlock({
  id: "hero-demo",
  type: "hero",
  title: "Lunsjordning for moderne kontor",
  subtitle: "Raskt, enkelt og premium for travle team",
  imageId: "",
  ctaLabel: "Kom i gang",
  ctaHref: "/kontakt",
});
const textDemo = normalizeBlock({
  id: "text-demo",
  type: "richText",
  heading: "Bedre lunsj med mindre administrasjon",
  body: "En enkel løsning for bedre lunsj på arbeidsplassen.",
});
const ctaDemo = normalizeBlock({
  id: "cta-demo",
  type: "cta",
  title: "Kom i gang",
  body: "Se hvordan Lunchportalen forenkler lunsjflyten på under én uke.",
  buttonLabel: "Book demo",
  buttonHref: "/kontakt",
});

export const DEMO_BLOCKS: Block[] = [heroDemo, textDemo, ctaDemo].filter((b): b is Block => Boolean(b));
