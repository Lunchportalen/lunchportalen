// app/page.tsx
import type { Metadata } from "next";
import Script from "next/script";

import PageShell from "./components/PageShell";
import Hero from "./components/Hero";
import Problem from "./components/Problem";
import Solution from "./components/Solution";
import HowItWorks from "./components/HowItWorks";
import Sustainability from "./components/Sustainability";
import Control from "./components/Control";
import Pricing from "./components/Pricing";
import FAQ from "./components/FAQ";
import FinalCTA from "./components/FinalCTA";

import { organizationJsonLd, websiteJsonLd } from "./lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Lunchportalen – firmalunsj med kontroll, mindre svinn og forutsigbarhet",
  description:
    "Lunchportalen er en digital lunsjløsning for bedrifter: dere setter rammene, ansatte bestiller selv innenfor avtalen, med cut-off kl. 08:00. Mindre matsvinn, mindre administrasjon, full oversikt.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Lunchportalen – firmalunsj med kontroll",
    description:
      "Mindre matsvinn. Mindre administrasjon. Full forutsigbarhet. En lunsjløsning utviklet for bedrifter.",
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
        <Problem />
        <Solution />
        <HowItWorks />
        <Sustainability />
        <Control />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </PageShell>
    </>
  );
}
