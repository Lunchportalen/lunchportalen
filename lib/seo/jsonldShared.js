function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanObject(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

export function buildFaqJsonLd(faqItems) {
  const mainEntity = (faqItems || [])
    .map((item) => {
      const q = compact(item?.q);
      const a = compact(item?.a);
      if (!q || !a) return null;
      return {
        "@type": "Question",
        name: q,
        acceptedAnswer: {
          "@type": "Answer",
          text: a,
        },
      };
    })
    .filter(Boolean);

  return cleanObject({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  });
}

export function buildBreadcrumbJsonLd(items) {
  const itemListElement = (items || [])
    .map((item, idx) => {
      const name = compact(item?.name);
      const entry = compact(item?.item);
      if (!name || !entry) return null;
      return {
        "@type": "ListItem",
        position: idx + 1,
        name,
        item: entry,
      };
    })
    .filter(Boolean);

  return cleanObject({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  });
}

export function buildArticleJsonLd({
  headline,
  description,
  url,
  image,
  datePublished,
  dateModified,
  publisherName = "Lunchportalen",
  publisherLogo = "https://www.lunchportalen.no/brand/LP-logo-uten-bakgrunn.png",
}) {
  const nowIso = new Date().toISOString();

  return cleanObject({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: compact(headline),
    description: compact(description),
    inLanguage: "nb-NO",
    mainEntityOfPage: compact(url),
    image: compact(image),
    datePublished: compact(datePublished || nowIso),
    dateModified: compact(dateModified || nowIso),
    author: {
      "@type": "Organization",
      name: compact(publisherName),
    },
    publisher: {
      "@type": "Organization",
      name: compact(publisherName),
      logo: {
        "@type": "ImageObject",
        url: compact(publisherLogo),
      },
    },
  });
}
