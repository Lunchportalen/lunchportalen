/**
 * Legacy seed bodies (rich copy) — **not** used by public `loadPublicPageWithTrustFallback` anymore;
 * allowlisted routes fail closed with {@link buildEditorialFallbackPublicBody} when Umbraco misses.
 * Retained for reference / tooling. Same block contract as backoffice (`version`, `blocks`, `meta`).
 */
import { SUPPORT_EMAIL } from "@/lib/system/emailAddresses";

import type { BlockConfig } from "@/lib/cms/design/designContract";
import type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";

function block(
  id: string,
  type: string,
  data: Record<string, unknown>,
  config?: BlockConfig,
): BlockNode {
  return { id, type, data, ...(config ? { config } : {}) };
}

const TRUST_SLUGS = ["om-oss", "kontakt", "personvern", "vilkar"] as const;

export type PublicTrustPageSlug = (typeof TRUST_SLUGS)[number];

export function isPublicTrustPageSlug(slug: string): slug is PublicTrustPageSlug {
  const n = slug.trim().toLowerCase();
  return (TRUST_SLUGS as readonly string[]).includes(n);
}

export function trustPageTitleForSlug(slug: string): string {
  const n = slug.trim().toLowerCase();
  switch (n) {
    case "om-oss":
      return "Om oss";
    case "kontakt":
      return "Kontakt oss";
    case "personvern":
      return "Personvern";
    case "vilkar":
      return "Vilkår";
    default:
      return "Lunchportalen";
  }
}

function metaSeo(title: string, description: string, canonicalPath: string): NonNullable<BlockList["meta"]> {
  return {
    surface: "public_trust_seed",
    seo: {
      title,
      description,
      canonical: canonicalPath,
    },
  };
}

function buildOmOssBody(): BlockList {
  return {
    version: 1,
    meta: metaSeo(
      "Om oss | Lunchportalen",
      "Lunchportalen leverer firmalunsj med kontroll, forutsigbarhet og mindre administrasjon — bygget for norske arbeidsplasser.",
      "/om-oss",
    ),
    blocks: [
      block("om-oss-lede", "rich_text", {
        heading: "",
        body:
          "<p>Lunchportalen er en norsk plattform for firmalunsj med tydelige rammer: én sannhetskilde for bestilling, produksjon og historikk. Vi bygger for rolig drift, sporbarhet og kvalitet — uten støy.</p>" +
            "<p>Teamet bak produktet jobber tett med kunder og operativ drift slik at opplevelsen i portalen matcher det som faktisk leveres i hverdagen.</p>",
        variant: "default",
      }),
    ],
  };
}

function buildKontaktBody(): BlockList {
  return {
    version: 1,
    meta: metaSeo(
      "Kontakt Lunchportalen | Firmalunsj for bedrifter",
      "Kontakt Lunchportalen for en trygg oppstart med firmalunsj og tydelige rammer.",
      "/kontakt",
    ),
    blocks: [
      block("kontakt-intro", "rich_text", {
        heading: "",
        body:
          "<p>Send en melding, så følger vi opp så raskt vi kan. Du får en RID-kvittering ved innsending.</p>",
        variant: "default",
      }),
    ],
  };
}

function buildPersonvernBody(): BlockList {
  const mail = SUPPORT_EMAIL;
  return {
    version: 1,
    meta: metaSeo(
      "Personvern | Lunchportalen",
      "Slik behandler Lunchportalen AS personopplysninger i tråd med gjeldende regelverk.",
      "/personvern",
    ),
    blocks: [
      block("personvern-policy", "rich_text", {
        heading: "",
        body: `<p class="text-sm text-muted-foreground">Sist oppdatert: 14.02.2026</p>
<h2 class="text-base font-semibold mt-6">1. Hvem gjelder dette?</h2>
<p>Denne erklæringen gjelder for bruk av Lunchportalen (tjenesten) og nettstedet, inkludert registrering, innlogging og bruk av bestillingsflyt. Tjenesten er laget for bedrifter, der firma-admin håndterer oppsett og brukere.</p>
<h2 class="text-base font-semibold mt-6">2. Hvilke opplysninger vi behandler</h2>
<p>Vi behandler kun opplysninger som er nødvendige for å levere avtalt funksjonalitet, typisk:</p>
<ul class="list-disc pl-5 space-y-1"><li>Kontaktinfo (navn, e-post, evt. telefon)</li><li>Firmatilknytning (firma, lokasjon/leveringssted, rolle)</li><li>Bestillinger/avbestillinger og relevante notater</li><li>Tekniske hendelser (RID, tidsstempel, feilkoder)</li></ul>
<h2 class="text-base font-semibold mt-6">3. Formål</h2>
<ul class="list-disc pl-5 space-y-1"><li>Levere og drifte tjenesten</li><li>Autentisering og tilgangsstyring</li><li>Produksjon/levering og kvalitetssikring</li><li>Support og feilsøking (inkludert RID-sporbarhet)</li><li>Etterlevelse av krav til sikkerhet og drift</li></ul>
<h2 class="text-base font-semibold mt-6">4. Behandlingsgrunnlag</h2>
<p>Vi behandler personopplysninger basert på avtale (for å levere tjenesten), berettiget interesse (drift, sikkerhet, kvalitet), og der det er relevant, rettslige forpliktelser.</p>
<h2 class="text-base font-semibold mt-6">5. Tilgang og deling</h2>
<p>Tilgang styres med rollebasert tilgang. Firma-admin ser kun sitt firma. Ansatte ser egne bestillinger. Superadmin har nødvendig tilgang for drift og support. Vi deler ikke personopplysninger med uvedkommende.</p>
<h2 class="text-base font-semibold mt-6">6. Lagringstid</h2>
<p>Opplysninger lagres så lenge det er nødvendig for formålet og avtalen, og i tråd med lovpålagte krav. Vi sletter eller anonymiserer når det ikke lenger er behov.</p>
<h2 class="text-base font-semibold mt-6">7. Informasjonskapsler (cookies)</h2>
<p>Vi bruker nødvendige cookies for innlogging og sikker drift. Eventuelle analyse-/markedsføringscookies brukes kun hvis det er aktivert med gyldig grunnlag.</p>
<h2 class="text-base font-semibold mt-6">8. Dine rettigheter</h2>
<p>Du kan be om innsyn, retting, begrensning og sletting der det er mulig. For henvendelser: <a class="underline font-medium" href="mailto:${mail}">${mail}</a>.</p>
<h2 class="text-base font-semibold mt-6">9. Sikkerhet</h2>
<p>Vi jobber systematisk med sikkerhet: tilgangsstyring, logging/sporbarhet, og tiltak for å unngå stille feil. Kontakt oss ved mistanke om sikkerhetshendelser.</p>
<p class="mt-6 rounded-2xl border bg-muted/30 p-4 text-sm"><strong class="text-xs font-semibold text-muted-foreground">Kontakt om personvern</strong><br />Send gjerne en melding via <a class="underline font-medium" href="/kontakt">kontaktsiden</a> eller e-post til <a class="underline font-medium" href="mailto:${mail}">${mail}</a>.</p>`,
        variant: "default",
      }),
    ],
  };
}

function buildVilkarBody(): BlockList {
  const mail = SUPPORT_EMAIL;
  return {
    version: 1,
    meta: metaSeo(
      "Vilkår | Lunchportalen",
      "Vilkår for bruk av Lunchportalen — klare rammer for firmakunder og trygg drift.",
      "/vilkar",
    ),
    blocks: [
      block("vilkar-policy", "rich_text", {
        heading: "",
        body: `<p class="text-sm text-muted-foreground">Sist oppdatert: 14.02.2026</p>
<h2 class="text-base font-semibold mt-6">1. Om tjenesten</h2>
<p>Lunchportalen er en bestillings- og administrasjonsplattform for firmalunsj. Plattformen er bygget for faste rammer, forutsigbarhet og kontroll, der bedriften (firma-admin) er primærkontakt og ansvarlig for interne brukere.</p>
<h2 class="text-base font-semibold mt-6">2. Roller og ansvar</h2>
<ul class="list-disc pl-5 space-y-1"><li><strong>Firma-admin</strong> oppretter og administrerer ansatte/brukere og avtalerammer.</li><li><strong>Ansatt</strong> bestiller/avbestiller innenfor avtalte rammer og frister.</li><li><strong>Leverandør</strong> drifter tjenesten og leverer i henhold til avtalt løsning og drift.</li></ul>
<h2 class="text-base font-semibold mt-6">3. Bestilling, avbestilling og cut-off</h2>
<p>Samme-dag avbestilling er mulig frem til <strong>kl. 08:00</strong> (Europe/Oslo) der dette er aktivert i avtalen. Etter cut-off er ordre låst for å sikre produksjon og leveringsstabilitet.</p>
<p class="mt-3 rounded-2xl border bg-muted/30 p-4 text-sm">Prinsipp: <strong>Én sannhetskilde</strong>. Det som står i portalen er fasit, og systemet er bygget for å unngå «stille feil».</p>
<h2 class="text-base font-semibold mt-6">4. Ingen unntak</h2>
<p>Tjenesten leveres etter faste rammer. Individuelle unntak utenfor avtale er normalt ikke mulig. Eventuelle endringer må gjøres som del av avtaleramme av firma-admin og godkjennes i prosessen der det er relevant.</p>
<h2 class="text-base font-semibold mt-6">5. Betaling og stenging</h2>
<p>Ved manglende betaling eller kontraktsbrudd kan tilgang til tjenesten stenges på firmanivå (Active / Paused / Closed). Dette gjøres kontrollert og kan ikke omgås av ansatte.</p>
<h2 class="text-base font-semibold mt-6">6. Drift og tilgjengelighet</h2>
<p>Vi tilstreber høy oppetid og forutsigbar drift. Ved vedlikehold eller hendelser kan funksjonalitet være midlertidig redusert. Kritiske problemer meldes inn via kontaktkanalen.</p>
<h2 class="text-base font-semibold mt-6">7. Personvern</h2>
<p>Behandling av personopplysninger følger vår <a class="underline font-medium" href="/personvern">personvernerklæring</a>.</p>
<h2 class="text-base font-semibold mt-6">8. Endringer i vilkår</h2>
<p>Vi kan oppdatere vilkårene ved behov. Ved vesentlige endringer varsles firmakunden gjennom egnede kanaler.</p>
<p class="mt-6 rounded-2xl border bg-muted/30 p-4 text-sm"><strong class="text-xs font-semibold text-muted-foreground">Spørsmål om vilkår?</strong><br />Ta kontakt via <a class="underline font-medium" href="/kontakt">kontaktsiden</a> eller e-post til <a class="underline font-medium" href="mailto:${mail}">${mail}</a>.</p>`,
        variant: "default",
      }),
    ],
  };
}

/** Deterministic seed body for a public trust slug (Umbraco/Supabase kan overstyre når publisert). */
export function buildPublicTrustPageSeedBody(slug: string): unknown {
  const n = slug.trim().toLowerCase();
  switch (n) {
    case "om-oss":
      return buildOmOssBody();
    case "kontakt":
      return buildKontaktBody();
    case "personvern":
      return buildPersonvernBody();
    case "vilkar":
      return buildVilkarBody();
    default:
      throw new Error(`Not a public trust slug: ${slug}`);
  }
}
