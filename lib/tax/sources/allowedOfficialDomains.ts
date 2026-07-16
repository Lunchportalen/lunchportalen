/**
 * Allowlist of official primary-source domains for tax/legal evidence ingestion.
 * Blog / Wikipedia / forum / unofficial aggregators are blocked.
 */

const ALLOWED_SUFFIXES = [
  "skatteetaten.no",
  "skatteverket.se",
  "skat.dk",
  "vero.fi",
  "gov.uk",
  "bundesfinanzministerium.de",
  "bzst.de",
  "impots.gouv.fr",
  "agenciatributaria.gob.es",
  "agenziaentrate.gov.it",
  "belastingdienst.nl",
  "finance.belgium.be",
  "estv.admin.ch",
  "admin.ch",
  "bmf.gv.at",
  "revenue.ie",
  "podatki.gov.pl",
  "gov.pl",
  "anaf.ro",
  "financnisprava.cz",
  "portaldasfinancas.gov.pt",
  "aade.gr",
  "canada.ca",
  "gc.ca",
  "revenuquebec.ca",
  "europa.eu",
  "ec.europa.eu",
  "streamlinedsalestax.org",
  // US state DORs (common official suffixes)
  "alabama.gov",
  "alaska.gov",
  "azdor.gov",
  "arkansas.gov",
  "ca.gov",
  "cdtfa.ca.gov",
  "colorado.gov",
  "ct.gov",
  "delaware.gov",
  "dc.gov",
  "floridarevenue.com",
  "georgia.gov",
  "hawaii.gov",
  "idaho.gov",
  "illinois.gov",
  "in.gov",
  "iowa.gov",
  "ksrevenue.gov",
  "ky.gov",
  "louisiana.gov",
  "maine.gov",
  "marylandtaxes.gov",
  "mass.gov",
  "michigan.gov",
  "state.mn.us",
  "ms.gov",
  "mo.gov",
  "mtrevenue.gov",
  "nebraska.gov",
  "nv.gov",
  "nh.gov",
  "nj.gov",
  "newmexico.gov",
  "ny.gov",
  "ncdor.gov",
  "nd.gov",
  "ohio.gov",
  "oklahoma.gov",
  "oregon.gov",
  "pa.gov",
  "ri.gov",
  "sc.gov",
  "sd.gov",
  "tn.gov",
  "texas.gov",
  "utah.gov",
  "vermont.gov",
  "virginia.gov",
  "wa.gov",
  "wv.gov",
  "wi.gov",
  "wyo.gov",
] as const;

const BLOCKED_HOST_FRAGMENTS = [
  "wikipedia.org",
  "medium.com",
  "blogspot.",
  "wordpress.com",
  "reddit.com",
  "quora.com",
  "stackoverflow.com",
  "forbes.com",
  "investopedia.com",
  "avalara.com",
  "taxjar.com",
  "vertexinc.com",
  "sovos.com",
] as const;

export function isOfficialSourceUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  if (BLOCKED_HOST_FRAGMENTS.some((f) => host.includes(f))) return false;
  return ALLOWED_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function assertOfficialSourceUrl(url: string): void {
  if (!isOfficialSourceUrl(url)) {
    throw new Error(`UNSUPPORTED_SOURCE_DOMAIN:${url}`);
  }
}
