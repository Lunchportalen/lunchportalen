// lib/system/docs.ts
import type { Role, SystemSection, SystemSectionId } from "./types";

export const SYSTEM_SECTIONS_ORDER: SystemSectionId[] = [
  "how-it-works",
  "roles",
  "ordering-model",
  "commercial-model",
  "security",
];

function only(roles: Role[]) {
  return { visibility: { roles } };
}

export const SYSTEM_SECTIONS: Record<SystemSectionId, SystemSection> = {
  "how-it-works": {
    id: "how-it-works",
    title: "Slik fungerer Lunchportalen",
    subtitle: "Produktets faktiske modell – ikke markedsføring. Dette er fasit.",
    blocks: [
      {
        title: "Hva Lunchportalen er",
        body: [
          "Lunchportalen er en firmalunsj-plattform bygget for kontroll, forutsigbarhet og lav administrasjon.",
          "Systemet er designet for å erstatte behovet for kantinedrift ved at mat produseres eksternt og leveres strukturert – uten manuelle unntak.",
        ],
      },
      {
        title: "Én sannhetskilde",
        body: [
          "Data i portalen er alltid fasit. Det finnes ingen manuelle overstyringer som kan skape skjulte avvik.",
          "Alle handlinger verifiseres server-side, og systemet bekrefter kun når lagring er verifisert.",
        ],
      },
      {
        title: "No-exception rule",
        body: [
          "Ingen individuelle unntak utenfor avtalte rammer. Dette er kjernen i skalerbar drift og enterprise-kontroll.",
          "Hvis noe ikke kan uttrykkes som en standardregel i systemet, stoppes det.",
        ],
      },
      {
        title: "Bærekraft og kontroll (uten støy)",
        body: [
          "Ansatte kan avbestille samme dag før kl. 08:00 (Europe/Oslo) for å redusere matsvinn og kostnad.",
          "AI kan brukes internt som motor for prognoser/rapportering, men er ikke et synlig lag i MVP.",
        ],
      },
    ],
  },

  roles: {
    id: "roles",
    title: "Roller og ansvar",
    subtitle: "Absolutte roller. Tydelig ansvar. Ingen sammenblanding.",
    blocks: [
      {
        title: "Ansatt (employee)",
        body: [
          "Selvbetjening: bestille/avbestille innenfor avtalte rammer.",
          "Ingen admin-ansvar, ingen rett til å endre rammer, priser, leveringsdager eller andre ansatte.",
          "Målet er at firma-admin skal slippe alle ansatt-henvendelser om lunsj.",
        ],
        ...only(["employee"]),
      },
      {
        title: "Firma-admin (company_admin)",
        body: [
          "Ansvar: rammer, ikke dag-til-dag valg.",
          "Oppretter og administrerer ansatte internt, og forholder seg til avtale/status i portalen.",
          "Ser status, avtalerammer, brukere og historikk – men skal ikke håndtere ansattes avbestillinger manuelt.",
        ],
        ...only(["company_admin"]),
      },
      {
        title: "Superadmin",
        body: [
          "Plattformdrift: aktivering/deaktivering av firma ved kontrakt/betaling, og standardiserte systemendringer.",
          "Eier drift, logging/audit-tankegang, endringsprosess og kvartalsvis videreutvikling.",
          "Ingen manuelle unntak per firma – endringer skal være standardiserbare.",
        ],
        ...only(["superadmin"]),
      },
      {
        title: "Kjøkken (kitchen)",
        body: [
          "Ser produksjonsgrunnlag strukturert per leveringsvindu → firma → lokasjon → ansatt.",
          "Leser bestillingsnotater og relevante felt for produksjon/merking.",
          "Har ikke rettigheter til å endre kommersielle rammer eller brukertilgang.",
        ],
        ...only(["kitchen"]),
      },
      {
        title: "Sjåfør (driver)",
        body: [
          "Ser leveringsoversikt og nødvendige leveringsdata per lokasjon.",
          "Ingen tilgang til intern firmestruktur utover leveringsbehov.",
        ],
        ...only(["driver"]),
      },

      // Felles fasit for alle roller (vises for alle)
      {
        title: "Felles prinsipp",
        body: [
          "Roller er absolutte: tilgang styres strengt av rolle og scope (company_id / location_id).",
          "Hvis en bruker ikke har gyldig scope eller rolle, skal systemet feile eksplisitt (401/403) – aldri stille feil.",
        ],
      },
    ],
  },

  "ordering-model": {
    id: "ordering-model",
    title: "Bestillingsmodell",
    subtitle: "Idempotent, server-validert og driftssikker.",
    blocks: [
      {
        title: "Cut-off kl. 08:00 (Europe/Oslo)",
        body: [
          "Bestilling/avbestilling samme dag er kun mulig før kl. 08:00.",
          "Etter cut-off er dagen låst for å sikre produksjonskontroll og minimal friksjon i drift.",
        ],
      },
      {
        title: "Idempotente handlinger",
        body: [
          "Samme handling kan trygt sendes flere ganger uten å skape duplikater eller inkonsistent status.",
          "Systemet returnerer alltid tydelig status (orderId, status, timestamp) når lagring er verifisert.",
        ],
      },
      {
        title: "Feildeteksjon og “ingen stille feil”",
        body: [
          "UI skal aldri bekrefte en handling uten server-verifisert lagring.",
          "Ved avvik skal systemet gi tydelig feilmelding og gjøre det enkelt å prøve igjen uten risiko for dobbeltregistrering.",
        ],
      },
      {
        title: "E-post-backup til drift (outbox/retry)",
        body: [
          "Bestillinger/avbestillinger skal ha automatisk e-post-backup til drift for ekstra integritet.",
          "Dette er en driftsmessig sikkerhetsline – portalen er fortsatt eneste sannhetskilde.",
        ],
      },
    ],
  },

  "commercial-model": {
    id: "commercial-model",
    title: "Kommersiell modell",
    subtitle: "Standardisert. Skalerbar. Ingen unntak.",
    blocks: [
      {
        title: "Minimum 20 ansatte",
        body: [
          "Firma må ha minimum 20 ansatte for å registrere interesse og inngå avtale.",
          "Dette er en bevisst terskel for driftseffektivitet og kvalitet i leveransen.",
        ],
      },
      {
        title: "Binding og oppsigelse",
        body: [
          "12 måneder bindingstid.",
          "3 måneder oppsigelse.",
        ],
      },
      {
        title: "Avtalemodell",
        body: [
          "Avtaler er firmestyrt. Firma-admin fastsetter nivå/rammer ved avtaleinngåelse, ikke ansatte.",
          "Ingen individuelle unntak. Hvis et behov ikke kan standardiseres, stoppes det.",
        ],
      },
      {
        title: "Prislogikk (ramme)",
        body: [
          "Pris kan være per ansatt, per lokasjon, eller per avtalt nivå – men må være entydig og systemstyrt.",
          "Målet er lav churn, lav OPEX og høy switching-cost gjennom integritet i daglig drift.",
        ],
      },
    ],
  },

  security: {
    id: "security",
    title: "Teknisk & sikkerhet (oversikt)",
    subtitle: "Kort, presist og troverdig – bygget på faktisk modell.",
    blocks: [
      {
        title: "Tilgangsstyring",
        body: [
          "Rollebasert tilgang med isolasjon mellom firma (tenant isolation).",
          "Scope-baserte regler: company_id/location_id brukes for å begrense data eksakt.",
        ],
      },
      {
        title: "Server-validering",
        body: [
          "Cut-off og statusregler valideres server-side.",
          "API-ruter skal alltid bruke standard route-guard for 401/403 og konsistent JSON-format.",
        ],
      },
      {
        title: "Audit / sporbarhet (tankegang)",
        body: [
          "Systemet er designet for revisjonslogg på firmanivå (senere lag), uten å bryte kjerneprinsippene.",
          "Målet er tydelighet: hvem endret hva og når – når enterprise-kunder krever det.",
        ],
      },
      {
        title: "Driftsintegritet",
        body: [
          "Ingen stille feil: handlinger bekreftes kun når lagring er verifisert.",
          "Backup/beredskap: ordre-backup via systemepost til drift som ekstra sikkerhetsline.",
        ],
      },
    ],
  },
};

export function getSystemSection(id: string): SystemSection | null {
  const key = String(id ?? "").trim() as SystemSectionId;
  return SYSTEM_SECTIONS[key] ?? null;
}

export function isVisibleForRole(blockRoles: Role[] | undefined, role: Role): boolean {
  if (!blockRoles || blockRoles.length === 0) return true;
  return blockRoles.includes(role);
}
