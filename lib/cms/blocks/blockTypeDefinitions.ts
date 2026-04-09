/**
 * U87: Canonical block type definitions (Umbraco-style data type contract).
 * Single source for identity, library copy, defaults, preview, canvas/editor routing metadata,
 * sections, validation hints, and differentiation vs sibling types.
 *
 * Downstream: `registry.ts` (CMSBlockDefinition), `backofficeBlockCatalog`, `blockLabels`,
 * `blockInspectorLead`, `editorCanvasFrameKind`, tests — thin adapters only.
 */

import type { SemanticIconKey } from "@/lib/iconRegistry";
import type { CMSBlockDefinition, CMSBlockFieldSchema } from "@/lib/cms/plugins/types";

/** Outer editor canvas frame (WorkspaceBody + blockCanvas/frames). */
export type BlockCanvasFrameKind =
  | "default"
  | "hero"
  | "cards"
  | "steps"
  | "pricing"
  | "cta"
  | "related"
  | "grid";

export type BlockEditorSection = {
  id: string;
  label: string;
  hint?: string;
};

export type BlockValidationRule = {
  id: string;
  message: string;
};

export type BlockTypeDefinition = {
  alias: string;
  title: string;
  shortTitle: string;
  description: string;
  whenToUse: string;
  /** Sibling aliases → one-line differentiation (explicit catalogue copy). */
  differsFrom: Partial<Record<string, string>>;
  icon: SemanticIconKey;
  libraryGroup: string;
  category: CMSBlockDefinition["category"];
  /** React property editor component basename (BlockPropertyEditorRouter). */
  propertyEditorComponent: string;
  /** Custom canvas frame component basename (WorkspaceBody switch). */
  canvasViewComponent: string;
  canvasFrameKind: BlockCanvasFrameKind;
  previewSummaryBuilder: (data: Record<string, unknown>) => string;
  defaultsFactory: () => Record<string, unknown>;
  validationRules: BlockValidationRule[];
  contentSections: BlockEditorSection[];
  settingsSections: BlockEditorSection[];
  structureSections: BlockEditorSection[];
  fields?: CMSBlockFieldSchema[];
};

const sec = (id: string, label: string, hint?: string): BlockEditorSection => ({ id, label, hint });

function previewHeroTitle(d: Record<string, unknown>): string {
  return String(d?.title ?? d?.heading ?? "");
}

const DEFINITIONS_LIST: BlockTypeDefinition[] = [
  {
    alias: "hero",
    title: "Hero (standard)",
    shortTitle: "Hero",
    description:
      "Standard toppseksjon i innholdsbredden: budskap, valgfritt bilde og én primær CTA. Rolig, trygg ramme for de fleste sider.",
    whenToUse:
      "Bruk når budskapet skal ligge i innholdsbredden med én tydelig handling — typisk under header, ikke som full-bleed kampanje.",
    differsFrom: {
      hero_full:
        "Full bredde og valgfri gradient — ikke den samme rolige innholdsbredden som standard-hero.",
      hero_bleed:
        "Kant-til-kant med mørk lesbarhetsflate og opptil to knapper — kraftigere enn standard-hero.",
    },
    icon: "home",
    libraryGroup: "Hero-familie",
    category: "marketing",
    propertyEditorComponent: "HeroPropertyEditor",
    canvasViewComponent: "HeroCanvasFrame",
    canvasFrameKind: "hero",
    previewSummaryBuilder: (d) => String(previewHeroTitle(d) || "Hero"),
    defaultsFactory: () => ({
      contentData: {
        title: "Forutsigbar firmalunsj – uten kantinebyrde",
        subtitle: "Én avtale, tydelig cut-off og full kontroll for admin.",
        imageId: "",
        imageAlt: "",
        ctaLabel: "Se hvordan det fungerer",
        ctaHref: "/lunsjordning",
      },
      settingsData: {},
    }),
    validationRules: [
      { id: "hero.title", message: "Tittel bør fylles ut før publisering." },
      { id: "hero.cta", message: "Primær CTA (tekst + lenke) styrer hovedhandlingen." },
    ],
    contentSections: [
      sec("headline", "Budskap", "Tittel og undertittel"),
      sec("media", "Bilde", "Valgfritt forsidebilde"),
      sec("primaryCta", "Primær handling", "Én knapp"),
    ],
    settingsSections: [],
    structureSections: [],
    fields: [
      { key: "title", label: "Tittel", kind: "text" },
      { key: "subtitle", label: "Undertittel", kind: "textarea" },
      { key: "imageId", label: "Bilde-ID (cms:* / media-UUID)", kind: "text" },
      { key: "ctaLabel", label: "Knappetekst", kind: "text" },
      { key: "ctaHref", label: "Knappelenke", kind: "text" },
    ],
  },
  {
    alias: "hero_full",
    title: "Hero (full bredde)",
    shortTitle: "Hero F",
    description:
      "Full bredde med bilde og valgfri gradient-overlegg — én tydelig CTA. Åpen og trygg forsides følelse uten kant-til-kant «wow»-overlay.",
    whenToUse:
      "Velg denne når forsiden skal føles luftig og full bredde, med valgfri gradient — men uten mørk bleed-overlay og to knapper.",
    differsFrom: {
      hero: "Ligger i full bredde med gradient-alternativ — ikke standard innholdsbredden.",
      hero_bleed: "Ingen kant-til-kant kampanje-layout med mørk flate og sekundærknapp.",
    },
    icon: "template",
    libraryGroup: "Hero-familie",
    category: "marketing",
    propertyEditorComponent: "HeroFullPropertyEditor",
    canvasViewComponent: "HeroCanvasFrame",
    canvasFrameKind: "hero",
    previewSummaryBuilder: (d) => String(previewHeroTitle(d) || "Hero full"),
    defaultsFactory: () => ({
      contentData: {
        title: "Bedre lunsjhverdag – med struktur ansatte forstår",
        subtitle: "Portal, meny og bestillingsflyt i ett system. Mindre admin, mindre svinn.",
        imageId: "",
        imageAlt: "",
        ctaLabel: "Utforsk løsningen",
        ctaHref: "/system-for-lunsjbestilling",
      },
      settingsData: { useGradient: true },
    }),
    validationRules: [
      { id: "hero_full.title", message: "Tittel anbefales for tydelig forsides budskap." },
      { id: "hero_full.gradient", message: "Gradient kan slås av for flatere uttrykk." },
    ],
    contentSections: [
      sec("headline", "Budskap"),
      sec("media", "Bilde og alt"),
      sec("gradient", "Gradient", "Valgfritt overlegg"),
      sec("primaryCta", "Primær CTA"),
    ],
    settingsSections: [],
    structureSections: [],
    fields: [
      { key: "title", label: "Tittel", kind: "text" },
      { key: "subtitle", label: "Undertittel", kind: "textarea" },
      { key: "imageId", label: "Bilde-ID (cms:* / media-UUID)", kind: "text" },
      { key: "imageAlt", label: "Alt-tekst", kind: "text" },
      { key: "ctaLabel", label: "Knappetekst", kind: "text" },
      { key: "ctaHref", label: "Knappelenke", kind: "text" },
    ],
  },
  {
    alias: "hero_bleed",
    title: "Hero (kant til kant)",
    shortTitle: "Hero+",
    description:
      "Kant-til-kant med bakgrunnsbilde, mørk lesbarhetsflate, valgfritt forgrunnsbilde og opptil to CTA-er. Layout-variant styrer tekst og overlay.",
    whenToUse:
      "Bruk til kampanje og sterke forsider når du trenger dramatikk, to knapper og kant-til-kant bildeflate — ikke til rolig innholds-hero.",
    differsFrom: {
      hero: "Full bleed med overlay og sekundær CTA — ikke den enkle innholdsbredden.",
      hero_full: "Mørkere, kampanjeorientert — ikke den åpne full-bredde-gradient-heroen.",
    },
    icon: "media",
    libraryGroup: "Hero-familie",
    category: "marketing",
    propertyEditorComponent: "HeroBleedPropertyEditor",
    canvasViewComponent: "HeroCanvasFrame",
    canvasFrameKind: "hero",
    previewSummaryBuilder: (d) => String(previewHeroTitle(d) || "Hero kant til kant"),
    defaultsFactory: () => ({
      contentData: {
        title: "",
        subtitle: "",
        ctaPrimary: "",
        ctaSecondary: "",
        ctaPrimaryHref: "",
        ctaSecondaryHref: "",
        backgroundImageId: "",
        overlayImageId: "",
        overlayImageAlt: "",
      },
      settingsData: {
        variant: "center",
        textAlign: "center",
        textPosition: "center",
        overlayPosition: "center",
      },
    }),
    validationRules: [
      { id: "hero_bleed.bg", message: "Bakgrunnsbilde bør settes for full effekt." },
      { id: "hero_bleed.primaryCta", message: "Minst én primær CTA anbefales." },
    ],
    contentSections: [
      sec("headline", "Budskap"),
      sec("background", "Bakgrunn"),
      sec("overlay", "Forgrunnsbilde", "Valgfritt"),
      sec("actions", "Primær og sekundær CTA"),
    ],
    settingsSections: [sec("layout", "Layout-variant", "Venstre / midt / høyre")],
    structureSections: [],
    fields: [
      { key: "title", label: "Tittel", kind: "text" },
      { key: "subtitle", label: "Undertittel", kind: "textarea" },
      { key: "ctaPrimary", label: "Primær CTA (tekst)", kind: "text" },
      { key: "ctaPrimaryHref", label: "Primær CTA (lenke)", kind: "text" },
      { key: "ctaSecondary", label: "Sekundær CTA (tekst)", kind: "text" },
      { key: "ctaSecondaryHref", label: "Sekundær CTA (lenke)", kind: "text" },
      { key: "backgroundImageId", label: "Bakgrunnsbilde-ID (cms:* / media-UUID)", kind: "text" },
      { key: "overlayImageId", label: "Overlay-bilde-ID (valgfri)", kind: "text" },
      { key: "overlayImageAlt", label: "Alt-tekst overlay-bilde", kind: "text" },
      { key: "variant", label: "Layout-variant (left/center/right)", kind: "text" },
    ],
  },
  {
    alias: "richText",
    title: "Tekstseksjon",
    shortTitle: "Tekst",
    description: "Overskrift og brødtekst (HTML) — ren tekstflate uten hero- eller knappekomponenter.",
    whenToUse: "Når du trenger forklarende eller juridisk tekst uten egen handlingskomponent.",
    differsFrom: {
      cta: "Ingen primærknapp eller handlingsstripe — kun tekst.",
    },
    icon: "content",
    libraryGroup: "Tekst og media",
    category: "content",
    propertyEditorComponent: "RichTextPropertyEditor",
    canvasViewComponent: "DefaultCanvasFrame",
    canvasFrameKind: "default",
    previewSummaryBuilder: (d) => String(d?.heading ?? d?.body ?? "Empty rich text"),
    defaultsFactory: () => ({ heading: "", body: "" }),
    validationRules: [{ id: "richtext.body", message: "Tom brødtekst gir lite innhold på siden." }],
    contentSections: [sec("heading", "Overskrift"), sec("body", "Brødtekst")],
    settingsSections: [],
    structureSections: [],
    fields: [
      { key: "heading", label: "Overskrift", kind: "text" },
      { key: "body", label: "Brødtekst", kind: "textarea" },
    ],
  },
  {
    alias: "image",
    title: "Bildeblokk",
    shortTitle: "Bilde",
    description: "Enkeltbilde med obligatorisk alt-tekst og valgfri bildetekst — ikke hero og ikke ikonflate.",
    whenToUse: "Én illustrasjon eller dokumentasjonsbilde midt i innholdet.",
    differsFrom: {
      hero: "Ikke toppbanner — kun enkeltbilde med bildetekst.",
    },
    icon: "media",
    libraryGroup: "Tekst og media",
    category: "content",
    propertyEditorComponent: "ImagePropertyEditor",
    canvasViewComponent: "DefaultCanvasFrame",
    canvasFrameKind: "default",
    previewSummaryBuilder: (d) => String(d?.alt ?? d?.caption ?? d?.imageId ?? "Empty image"),
    defaultsFactory: () => ({ imageId: "", alt: "", caption: "" }),
    validationRules: [
      { id: "image.alt", message: "Alt-tekst er påkrevd for tilgjengelighet." },
      { id: "image.source", message: "Velg bilde-ID før publisering." },
    ],
    contentSections: [sec("asset", "Bilde"), sec("alt", "Alt og bildetekst")],
    settingsSections: [],
    structureSections: [],
    fields: [
      { key: "imageId", label: "Bilde-ID (cms:* / media-UUID / sti)", kind: "text" },
      { key: "alt", label: "Alt", kind: "text" },
      { key: "caption", label: "Bildetekst", kind: "text" },
    ],
  },
  {
    alias: "cta",
    title: "Handlingsseksjon (CTA)",
    shortTitle: "CTA",
    description:
      "Avsluttende eller midtside-handling med overskrift, støttetekst, primærknapp og valgfri sekundær tekstlenke. Ikke «Banner»/strip: banner er kort budskap på bakgrunnsbilde med én knapp, uten samme seksjonsdybde.",
    whenToUse:
      "Når leseren skal forstå kontekst før klikk — mer tekst og sekundær sti enn en bannerstripe.",
    differsFrom: {
      banner: "Mer seksjonsinnhold og sekundær handling — ikke kort strip med ett budskap.",
    },
    icon: "order",
    libraryGroup: "Handling",
    category: "marketing",
    propertyEditorComponent: "CtaPropertyEditor",
    canvasViewComponent: "CtaCanvasFrame",
    canvasFrameKind: "cta",
    previewSummaryBuilder: (d) => String(d?.title ?? d?.buttonLabel ?? "Empty CTA"),
    defaultsFactory: () => ({
      contentData: {
        eyebrow: "Neste steg",
        title: "Klar for roligere lunsjdrift?",
        body: "La teamet få én tydelig flyt – fra meny til bestilling – uten manuelt mas.",
      },
      settingsData: {},
      structureData: {
        buttonLabel: "Start en samtale",
        buttonHref: "/kontakt",
        secondaryButtonLabel: "Se priser",
        secondaryButtonHref: "/priser",
      },
    }),
    validationRules: [
      { id: "cta.primary", message: "Primærknapp bør ha både tekst og lenke." },
      { id: "cta.body", message: "Støttetekst hjelper beslutning før klikk." },
    ],
    contentSections: [sec("eyebrow", "Overlinje", "Valgfritt"), sec("headline", "Tittel"), sec("body", "Støttetekst")],
    settingsSections: [],
    structureSections: [sec("actions", "Primær og sekundær knapp")],
    fields: [
      { key: "title", label: "Tittel", kind: "text" },
      { key: "body", label: "Tekst", kind: "textarea" },
      { key: "buttonLabel", label: "Knapp", kind: "text" },
      { key: "buttonHref", label: "Lenke", kind: "text" },
    ],
  },
  {
    alias: "banner",
    title: "Banner (strip)",
    shortTitle: "Banner",
    description:
      "Kort budskap med én knapp over bakgrunnsbilde — tenk strip eller promo-linje. Bruk «Handlingsseksjon (CTA)» når du trenger tydelig seksjon med mer tekst og sekundær handling.",
    whenToUse: "Kort oppmerksomhet mellom avsnitt — ikke full CTA-seksjon med støttetekst.",
    differsFrom: {
      cta: "Kortere budskap, én knapp — ikke handlingsseksjon med sekundær lenke og brødtekst.",
    },
    icon: "menu",
    libraryGroup: "Handling",
    category: "marketing",
    propertyEditorComponent: "BannerPropertyEditor",
    canvasViewComponent: "DefaultCanvasFrame",
    canvasFrameKind: "default",
    previewSummaryBuilder: (d) => String(d?.text ?? "Banner"),
    defaultsFactory: () => ({
      text: "Klar for en roligere lunsjuke?",
      ctaLabel: "Se hvordan",
      ctaHref: "/kontakt",
      backgroundImageId: "",
    }),
    validationRules: [
      { id: "banner.text", message: "Kort tekst anbefales — strip-format." },
      { id: "banner.bg", message: "Bakgrunnsbilde gir visuell tyngde." },
    ],
    contentSections: [sec("message", "Budskap"), sec("cta", "Knapp")],
    settingsSections: [sec("background", "Bakgrunn")],
    structureSections: [],
    fields: [
      { key: "text", label: "Tekst", kind: "textarea" },
      { key: "ctaLabel", label: "Knapp", kind: "text" },
      { key: "ctaHref", label: "Lenke", kind: "text" },
      { key: "backgroundImageId", label: "Bakgrunnsbilde-ID", kind: "text" },
    ],
  },
  {
    alias: "cards",
    title: "Kort-seksjon",
    shortTitle: "Kort",
    description:
      "Tre verdi-kort med ingress og valgfrie seksjons-CTA-er — for budskap i rader, ikke lokasjonsbevis (bruk «Lokasjonsrutenett» for celler med meta per sted) og ikke hero (bruk hero-variantene øverst).",
    whenToUse: "Når du vil forklare fordeler eller temaer i like kort, ikke lokasjonsbevis per celle.",
    differsFrom: {
      grid: "Verdikort med samme mønster — ikke lokasjonsrutenett med meta per sted.",
      zigzag: "Statiske kort — ikke nummerert prosess eller FAQ-steg.",
    },
    icon: "template",
    libraryGroup: "Lister og rutenett",
    category: "marketing",
    propertyEditorComponent: "CardsPropertyEditor",
    canvasViewComponent: "CardsCanvasFrame",
    canvasFrameKind: "cards",
    previewSummaryBuilder: (d) => String(d?.title ?? "Kort"),
    defaultsFactory: () => ({
      contentData: {
        title: "Derfor velger bedrifter struktur fremfor ad hoc",
        text: "Samme informasjon til alle, tydelige frister og sporbar bestilling.",
      },
      settingsData: { presentation: "feature" as const },
      structureData: {
        items: [
          {
            kicker: "Kontroll",
            title: "Administrativ ro",
            text: "Én cut-off, ett overblikk og færre avklaringer i hverdagen.",
          },
          {
            kicker: "Ansatte",
            title: "Enkel hverdag",
            text: "Selvbetjening med tydelig meny og forutsigbare leveranser.",
          },
          {
            kicker: "Drift",
            title: "Mindre svinn",
            text: "Bestillinger og avbestillinger som faktisk kan styres.",
          },
        ],
        cta: [] as { label: string; href: string; variant?: string }[],
      },
    }),
    validationRules: [
      { id: "cards.items", message: "Fyll ut tittel og tekst per kort for best effekt." },
      { id: "cards.presentation", message: "Presentasjon styrer ikon vs. rolig kortflate." },
    ],
    contentSections: [sec("sectionHead", "Seksjonstittel og ingress")],
    settingsSections: [sec("presentation", "Kortstil")],
    structureSections: [sec("items", "Kort i samling"), sec("sectionCtas", "Valgfrie seksjons-CTA-er")],
    fields: [
      { key: "title", label: "Seksjonstittel", kind: "text" },
      { key: "text", label: "Ingress", kind: "textarea" },
    ],
  },
  {
    alias: "zigzag",
    title: "Steg / prosess",
    shortTitle: "Steg",
    description:
      "Ordnet flyt med stegnummer, tekst og bilde, eller FAQ-variant. Én katalogtype (`zigzag`) — innholdet er `steps`-listen.",
    whenToUse: "Forklar rekkefølge (onboarding, leveranse) eller FAQ med tydelige steg.",
    differsFrom: {
      cards: "Nummerert flyt eller FAQ — ikke tre like verdi-kort.",
      relatedLinks: "Egenprodusert innhold — ikke automatisk kuraterte lenker.",
    },
    icon: "menu",
    libraryGroup: "Lister og rutenett",
    category: "marketing",
    propertyEditorComponent: "StepsPropertyEditor",
    canvasViewComponent: "StepsCanvasFrame",
    canvasFrameKind: "steps",
    previewSummaryBuilder: (d) => String(d?.title ?? "Steg"),
    defaultsFactory: () => ({
      contentData: {
        title: "Slik fungerer det i praksis",
        intro: "Tre tydelige steg fra avtale til leveranse – uten støy.",
      },
      settingsData: { presentation: "process" as const },
      structureData: {
        steps: [
          {
            step: "1",
            kicker: "Avtale",
            title: "Koble firma og lokasjon",
            text: "Vi setter rammer, roller og hvilke menyer som gjelder.",
            imageId: "",
          },
          {
            step: "2",
            kicker: "Bestilling",
            title: "Ansatte bestiller selv",
            text: "Meny, frist og bekreftelse – samme opplevelse for alle.",
            imageId: "",
          },
          {
            step: "3",
            kicker: "Leveranse",
            title: "Forutsigbar produksjon",
            text: "Kjøkken og logistikk ser tallene de faktisk kan stole på.",
            imageId: "",
          },
        ],
      },
    }),
    validationRules: [
      { id: "zigzag.steps", message: "Hvert steg bør ha tittel og forklaring." },
      { id: "zigzag.mode", message: "Velg prosess eller FAQ etter behov." },
    ],
    contentSections: [sec("intro", "Ingress")],
    settingsSections: [sec("presentation", "Modus", "Prosess eller FAQ")],
    structureSections: [sec("steps", "Steg-liste")],
    fields: [{ key: "title", label: "Seksjonstittel", kind: "text" }],
  },
  {
    alias: "pricing",
    title: "Priser",
    shortTitle: "Pris",
    description:
      "Tom planliste = live priser på publisert side. Fyll ut to pakker for manuell prisvisning i blokken.",
    whenToUse: "Prisingssammenligning med planer og feature-lister — ikke generelle verdi-kort.",
    differsFrom: {
      cards: "Pris og pakker — ikke generelle fordelskort uten prisstruktur.",
    },
    icon: "invoice",
    libraryGroup: "Pris",
    category: "marketing",
    propertyEditorComponent: "PricingPropertyEditor",
    canvasViewComponent: "PricingCanvasFrame",
    canvasFrameKind: "pricing",
    previewSummaryBuilder: (d) => String(d?.title ?? "Priser"),
    defaultsFactory: () => ({
      contentData: {
        title: "To nivå – tydelig avtale",
        intro: "Avtalen settes av firma. Priser kan hentes live eller redigeres manuelt her.",
        footnote: "Alle priser vises som veiledende inntil avtale er bekreftet.",
      },
      settingsData: {},
      structureData: {
        plans: [] as {
          name: string;
          tagline?: string;
          badge?: string;
          price: string;
          period?: string;
          featured?: boolean;
          features: string[];
          ctaLabel?: string;
          ctaHref?: string;
        }[],
      },
    }),
    validationRules: [
      { id: "pricing.plans", message: "Tom liste viser live priser — fyll ut for manuell tabell." },
      { id: "pricing.features", message: "Prikkliste per plan gjør sammenligning enklere." },
    ],
    contentSections: [sec("head", "Overskrift og ingress"), sec("footnote", "Fotnote")],
    settingsSections: [],
    structureSections: [sec("plans", "Pakker / planrader")],
    fields: [
      { key: "title", label: "Overskrift", kind: "text" },
      { key: "intro", label: "Ingress (valgfri)", kind: "textarea" },
    ],
  },
  {
    alias: "grid",
    title: "Lokasjonsrutenett",
    shortTitle: "Rutenett",
    description:
      "Bevis- eller lokasjonsrutenett med bilde, tittel, undertittel og meta-linje per celle — ikke verdi-kort (bruk kort-seksjon) og ikke prisrader.",
    whenToUse: "Når hver celle representerer et sted eller et sporbarhetsbevis — ikke generelle fordeler.",
    differsFrom: {
      cards: "Lokasjon/meta per celle — ikke tre like verdi-kort.",
    },
    icon: "location",
    libraryGroup: "Lister og rutenett",
    category: "marketing",
    propertyEditorComponent: "GridPropertyEditor",
    canvasViewComponent: "GridCanvasFrame",
    canvasFrameKind: "grid",
    previewSummaryBuilder: (d) => String(d?.title ?? "Lokasjonsrutenett"),
    defaultsFactory: () => ({
      contentData: {
        title: "Der vi leverer forutsigbarhet",
        intro: "Lokale team og faste rammer – samme system uansett by.",
      },
      settingsData: { variant: "center" },
      structureData: {
        items: [
          { title: "Oslo", subtitle: "Bedriftslunsj", metaLine: "Cut-off 08:00 · faste vinduer", imageId: "" },
          { title: "Bergen", subtitle: "Lunsj til kontoret", metaLine: "Koordinert leveranse", imageId: "" },
          { title: "Trondheim", subtitle: "Portal + meny", metaLine: "Sporbar bestilling", imageId: "" },
        ],
      },
    }),
    validationRules: [
      { id: "grid.cells", message: "Fyll undertittel eller meta for å skille celler." },
      { id: "grid.variant", message: "Variant styrer tekstjustering i rutenettet." },
    ],
    contentSections: [sec("head", "Seksjonstittel og ingress")],
    settingsSections: [sec("variant", "Layoutvariant")],
    structureSections: [sec("items", "Celler")],
    fields: [{ key: "title", label: "Seksjonstittel", kind: "text" }],
  },
  {
    alias: "divider",
    title: "Skillelinje",
    shortTitle: "Skille",
    description: "Tynn linje eller luft mellom seksjoner — ingen innhold, kun rytme.",
    whenToUse: "Visuell pause uten ny tekst — mellom tunge seksjoner.",
    differsFrom: {},
    icon: "menu",
    libraryGroup: "Layout",
    category: "layout",
    propertyEditorComponent: "DividerPropertyEditor",
    canvasViewComponent: "DefaultCanvasFrame",
    canvasFrameKind: "default",
    previewSummaryBuilder: () => "Skillelinje",
    defaultsFactory: () => ({}),
    validationRules: [],
    contentSections: [],
    settingsSections: [sec("style", "Stil", "Linje eller luft")],
    structureSections: [],
  },
  {
    alias: "form",
    title: "Skjemablokk",
    shortTitle: "Skjema",
    description: "Bygg inn eksternt skjema via ID — ikke CTA-seksjon og ikke tekstblokk.",
    whenToUse: "Når et konkret skjema skal embeddes med kjent form-ID.",
    differsFrom: {
      cta: "Embed av skjema — ikke fri tekst-handling.",
    },
    icon: "form",
    libraryGroup: "Skjema",
    category: "content",
    propertyEditorComponent: "FormPropertyEditor",
    canvasViewComponent: "DefaultCanvasFrame",
    canvasFrameKind: "default",
    previewSummaryBuilder: (d) => String(d?.title ?? "Skjema"),
    defaultsFactory: () => ({
      formId: "",
      title: "Skjema",
    }),
    validationRules: [{ id: "form.id", message: "Skjema-ID må settes for at innebygging skal virke." }],
    contentSections: [sec("title", "Tittel")],
    settingsSections: [],
    structureSections: [sec("embed", "Skjema-ID")],
    fields: [
      { key: "formId", label: "Form-ID", kind: "text" },
      { key: "title", label: "Tittel", kind: "text" },
    ],
  },
  {
    alias: "relatedLinks",
    title: "Relaterte sider",
    shortTitle: "Lenker",
    description:
      "Kuratert relatert innhold: sti, stikkord og maks antall styrer hvilke sider som foreslås — ikke en fri lenkeblokk.",
    whenToUse:
      "Når relaterte sider skal foreslås automatisk uten manuelle URL-rader — styrt av sti og stikkord (kuratert oppdagelse, ikke fri lenkeblokk).",
    differsFrom: {
      zigzag: "Automatisk kuratering — ikke manuelt bygde steg eller FAQ.",
      cta: "Liste av forslag — ikke én primær konverteringshandling.",
    },
    icon: "globe",
    libraryGroup: "Lister og rutenett",
    category: "marketing",
    propertyEditorComponent: "RelatedLinksPropertyEditor",
    canvasViewComponent: "RelatedCanvasFrame",
    canvasFrameKind: "related",
    previewSummaryBuilder: () => "Relaterte sider",
    defaultsFactory: () => ({
      contentData: {
        title: "Relaterte sider",
        subtitle: "Gå dypere i modell, system og lokale sider.",
      },
      settingsData: {
        currentPath: "/",
        maxSuggestions: 6,
      },
      structureData: {
        tags: ["core", "lokal"] as string[],
      },
    }),
    validationRules: [
      { id: "related.tags", message: "Stikkord styrer relevans — minst ett anbefales." },
      { id: "related.path", message: "Aktiv sti bør speilet siden blokken står på." },
    ],
    contentSections: [sec("copy", "Overskrift og undertekst")],
    settingsSections: [sec("scope", "Sti og maks antall")],
    structureSections: [sec("tags", "Stikkord", "Kuratert oppdagelse")],
    fields: [
      { key: "currentPath", label: "Aktiv sti", kind: "text" },
      { key: "title", label: "Overskrift (valgfri)", kind: "text" },
      { key: "subtitle", label: "Undertekst (valgfri)", kind: "textarea" },
      { key: "maxSuggestions", label: "Maks antall lenker (1–12)", kind: "text" },
      { key: "emptyFallbackText", label: "Tekst ved ingen treff (valgfri)", kind: "textarea" },
    ],
  },
];

export const BLOCK_TYPE_DEFINITION_BY_ALIAS: Record<string, BlockTypeDefinition> = Object.fromEntries(
  DEFINITIONS_LIST.map((d) => [d.alias, d]),
);

/** Must match plugin + public render allowlist (order = `DEFINITIONS_LIST`). */
export type CoreRenderBlockType =
  | "hero"
  | "hero_full"
  | "hero_bleed"
  | "banner"
  | "richText"
  | "image"
  | "cta"
  | "cards"
  | "zigzag"
  | "pricing"
  | "grid"
  | "divider"
  | "form"
  | "relatedLinks";

export const CORE_RENDER_BLOCK_TYPES: readonly CoreRenderBlockType[] = DEFINITIONS_LIST.map(
  (d) => d.alias as CoreRenderBlockType,
) as readonly CoreRenderBlockType[];

/** Stable plugin registration order (matches legacy `registry.ts` ordering). */
export const CORE_CMS_BLOCK_DEFINITIONS: CMSBlockDefinition[] = DEFINITIONS_LIST.map((d) => ({
  type: d.alias,
  label: d.title,
  description: d.description,
  category: d.category,
  icon: d.icon,
  defaults: d.defaultsFactory,
  previewText: d.previewSummaryBuilder,
  fields: d.fields,
}));

export function getBlockTypeDefinition(alias: string): BlockTypeDefinition | undefined {
  return BLOCK_TYPE_DEFINITION_BY_ALIAS[alias];
}

export function getCanvasFrameKindForBlockType(type: string): BlockCanvasFrameKind {
  return getBlockTypeDefinition(type)?.canvasFrameKind ?? "default";
}

export function toCMSBlockDefinition(d: BlockTypeDefinition): CMSBlockDefinition {
  return {
    type: d.alias,
    label: d.title,
    description: d.description,
    category: d.category,
    icon: d.icon,
    defaults: d.defaultsFactory,
    previewText: d.previewSummaryBuilder,
    fields: d.fields,
  };
}

/** Test / tooling: property editor component basename per alias. */
export const PROPERTY_EDITOR_COMPONENT_BY_ALIAS: Record<string, string> = Object.fromEntries(
  DEFINITIONS_LIST.map((d) => [d.alias, d.propertyEditorComponent]),
);

/** Test / tooling: canvas custom view component basename per alias. */
export const CANVAS_VIEW_COMPONENT_BY_ALIAS: Record<string, string> = Object.fromEntries(
  DEFINITIONS_LIST.map((d) => [d.alias, d.canvasViewComponent]),
);

export const KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS = [
  "hero",
  "hero_full",
  "hero_bleed",
  "cards",
  "zigzag",
  "pricing",
  "grid",
  "cta",
  "relatedLinks",
] as const;
