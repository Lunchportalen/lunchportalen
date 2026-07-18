export const ACCESS = "2026-07-18";
export const P = (major) => Math.round(Number(major) * 100);

export function src(url, title, kind, operator, geography, fact) {
  return { url, title, kind, operator, geography, fact };
}
export function price(id, source_url, operator, geography, offering, price_minor, currency, opts = {}) {
  return {
    id,
    source_url,
    access_date: ACCESS,
    operator,
    geography,
    offering,
    price_minor,
    currency,
    tax_inclusion: opts.tax_inclusion ?? "unknown",
    delivery_included: opts.delivery_included ?? null,
    minimum_order: opts.minimum_order ?? null,
    recurring: opts.recurring ?? false,
    package_equivalent: opts.package_equivalent ?? null,
    confidence: opts.confidence ?? 0.8,
  };
}
export function menu(id, source_url, operator, geography, offering, format, confidence = 0.8) {
  return { id, source_url, access_date: ACCESS, operator, geography, offering, format, confidence };
}

export function finalize(doc) {
  const workplace_sources = doc.sources.filter((s) => s.kind === "workplace").length;
  const commercial_sources = doc.sources.filter((s) => s.kind === "commercial" || s.kind === "economics").length;
  const price_count = doc.price_observations.length;
  const menu_count = doc.menu_observations.length;
  const source_count = doc.sources.length;
  const shortfall = [];
  if (price_count < 12) shortfall.push(`price_observations ${price_count}/12`);
  if (menu_count < 12) shortfall.push(`menu_observations ${menu_count}/12`);
  if (source_count < 4) shortfall.push(`sources ${source_count}/4`);
  if (workplace_sources < 2) shortfall.push(`workplace_sources ${workplace_sources}/2`);
  if (commercial_sources < 2) shortfall.push(`commercial_sources ${commercial_sources}/2`);
  const complete = shortfall.length === 0;
  return {
    ...doc,
    completeness: {
      price_count,
      menu_count,
      source_count,
      workplace_sources,
      commercial_sources,
      complete,
      shortfall: shortfall.length ? shortfall.join("; ") : null,
    },
  };
}
