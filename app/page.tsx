// app/page.tsx
import type { Metadata } from "next";
import Script from "next/script";

import PageShell from "@/components/PageShell";
import Hero from "@/components/Hero";

import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Lunchportalen – firmalunsj med kontroll og forutsigbarhet",
  description:
    "Bestill og administrer firmalunsj med faste rammer, cut-off kl. 08:00 og full oversikt. Lunchportalen gir bedrifter kontroll – uten støy.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Lunchportalen – firmalunsj med kontroll og forutsigbarhet",
    description:
      "Bestill og administrer firmalunsj med faste rammer, cut-off kl. 08:00 og full oversikt. Lunchportalen gir bedrifter kontroll – uten støy.",
    type: "website",
    url: "https://lunchportalen.no/",
  },
};

export default function MarketingHome() {
  const jsonld = [organizationJsonLd(), websiteJsonLd()];

  return (
    <>
      <Script
        id="jsonld-home"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }}
      />

      <PageShell>
        <Hero />
      </PageShell>
    </>
  );
}
