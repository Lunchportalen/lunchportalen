import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { faqForPage } from "@/lib/seo/faq";
import { getMarketingPage } from "@/lib/seo/marketingRegistry";
import { createPageMetadata } from "@/lib/seo/meta";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seo/jsonld";
import { buildArticleJsonLd } from "@/lib/seo/jsonldShared";
import { canonicalForPath } from "@/lib/seo/site";

const PATH = "/definitiv-guide-firmalunsj";
const TITLE = "Den definitive guiden til firmalunsj i Norge";
const DESCRIPTION =
  "Komplett guide for bedrifter om firmalunsj: styringsmodell, cut-off kl. 08:00, roller, risikokontroll og implementering.";

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata(getMarketingPage(PATH));
}

export default function Page() {
  const faqItems = faqForPage(PATH);
  const url = canonicalForPath(PATH);

  const webPageLd = webPageJsonLd({
    url,
    name: TITLE,
    description: DESCRIPTION,
    inLanguage: "nb-NO",
  });

  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Forside", item: canonicalForPath("/") },
    { name: "Definitiv guide til firmalunsj", item: url },
  ]);

  const faqLd = faqJsonLd(faqItems);
  const articleLd = buildArticleJsonLd({
    headline: TITLE,
    description: DESCRIPTION,
    url,
    image: canonicalForPath("/og/og-firmalunsj-guide-1200x630.jpg"),
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
  });

  return (
    <main className="lp-home">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <section className="lp-section">
        <div className="lp-container">
          <h1 className="lp-h1">Den definitive guiden til firmalunsj i Norge</h1>
          <p className="lp-lead">
            Firmalunsj fungerer best når modellen er tydelig: bedriften setter rammene, ansatte bestiller innenfor
            rammene, og dagen låses kl. 08:00. Denne guiden viser hvordan dere bygger en stabil ordning med lav
            administrasjon, høy forutsigbarhet og klar rollefordeling.
          </p>

          <h2 className="lp-h2" style={{ marginTop: 24 }}>1. Hvorfor firmalunsj må styres som en prosess</h2>
          <p className="lp-p">
            Firmalunsj påvirker kostnad, trivsel og daglig drift. Når bestillinger går i sidekanaler, oppstår ofte
            avklaringsstøy og usikkerhet. Med én plattform og faste regler blir flyten enklere å følge, enklere å måle
            og enklere å forbedre.
          </p>

          <h2 className="lp-h2">2. Rollen til cut-off kl. 08:00</h2>
          <p className="lp-p">
            Cut-off er kontrollpunktet som gjør produksjonsgrunnlaget stabilt. Etter fristen kan leveranse planlegges
            på et låst og tydelig datagrunnlag. Det gir færre avvik i drift og mindre intern koordinering.
          </p>

          <h2 className="lp-h2">3. Roller som reduserer risiko</h2>
          <p className="lp-p">
            Ledelsen setter retning, firmaadmin styrer rammer, ansatte bestiller selv innenfor rammene og leveransen
            skjer basert på samme status for alle. Klare roller gjør ordningen robust over tid.
          </p>

          <h2 className="lp-h2">4. Innføring uten støy</h2>
          <p className="lp-p">
            Start med få og tydelige regler, informer om frister, og hold modellen stabil i oppstartsfasen. Når
            kjernereglene fungerer, kan dere justere kontrollert uten å skape ny kompleksitet.
          </p>

          <div className="lp-linkChips" style={{ marginTop: 20 }}>
            <Link className="lp-linkChip" href="/registrering">Registrer firma</Link>
            <Link className="lp-linkChip" href="/lunsjordning">Lunsjordning for bedrifter</Link>
            <Link className="lp-linkChip" href="/hva-er-lunsjordning">Hva er lunsjordning</Link>
            <Link className="lp-linkChip" href="/hvordan">Slik fungerer det</Link>
            <Link className="lp-linkChip" href="/system-for-lunsjbestilling">System for lunsjbestilling</Link>
            <Link className="lp-linkChip" href="/alternativ-til-kantine">Alternativ til kantine</Link>
            <Link className="lp-linkChip" href="/lunsj-levering-oslo">Lunsjordning i Oslo</Link>
            <Link className="lp-linkChip" href="/lunsjordning-trondheim">Lunsjordning i Trondheim</Link>
            <Link className="lp-linkChip" href="/lunch-levering-bergen">Lunsjordning i Bergen</Link>
            <Link className="lp-linkChip" href="/kontakt">Kontakt om firmalunsj</Link>
          </div>
        </div>
      </section>

      <section className="lp-section alt" aria-label="FAQ">
        <div className="lp-container">
          <h2 className="lp-h2">Spørsmål og svar</h2>
          <div className="lp-faqList">
            {faqItems.map((item) => (
              <details className="lp-faqRow" key={item.q}>
                <summary className="lp-faqSummary">
                  <span>{item.q}</span>
                  <span className="inline-flex shrink-0">
                    <Icon name="chevronDown" size="sm" className="lp-faq-chevron" />
                  </span>
                </summary>
                <p className="lp-faqAnswer">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
