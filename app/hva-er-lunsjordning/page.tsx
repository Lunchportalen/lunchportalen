import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { faqForPage } from "@/lib/seo/faq";
import { getMarketingPage } from "@/lib/seo/marketingRegistry";
import { createPageMetadata } from "@/lib/seo/meta";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seo/jsonld";
import { buildArticleJsonLd } from "@/lib/seo/jsonldShared";
import { canonicalForPath } from "@/lib/seo/site";

const PATH = "/hva-er-lunsjordning";
const TITLE = "Hva er lunsjordning? Definisjon for bedrifter";
const DESCRIPTION =
  "En tydelig definisjon av lunsjordning for bedrift: modell, ansvar, cut-off kl. 08:00 og hva som gir stabil drift.";

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
    { name: "Hva er lunsjordning", item: url },
  ]);

  const faqLd = faqJsonLd(faqItems);
  const articleLd = buildArticleJsonLd({
    headline: TITLE,
    description: DESCRIPTION,
    url,
    image: canonicalForPath("/og/og-default-1200x630.jpg"),
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
          <h1 className="lp-h1">Hva er lunsjordning?</h1>
          <p className="lp-lead">
            En lunsjordning er en fast modell for firmalunsj der bedriften setter rammene, ansatte bestiller innenfor
            rammene og leveransen planlegges på låst grunnlag etter cut-off kl. 08:00. Målet er mindre støy, færre
            avvik og mer forutsigbar drift.
          </p>

          <div className="lp-cards3" style={{ marginTop: 20 }}>
            <div className="lp-card soft lp-card-pad">
              <h2 className="lp-h3">Hva modellen styrer</h2>
              <p className="lp-p">Roller, frister og beslutningsgrunnlag i én plattform.</p>
            </div>
            <div className="lp-card soft lp-card-pad">
              <h2 className="lp-h3">Hvorfor bedrifter velger dette</h2>
              <p className="lp-p">Lavere administrativ belastning og tydeligere ansvar i hverdagen.</p>
            </div>
            <div className="lp-card soft lp-card-pad">
              <h2 className="lp-h3">Hvordan driften blir stabil</h2>
              <p className="lp-p">Cut-off kl. 08:00 låser dagen og gir forutsigbar produksjon.</p>
            </div>
          </div>

          <div className="lp-linkChips" style={{ marginTop: 20 }}>
            <Link className="lp-linkChip" href="/registrering">Registrer firma</Link>
            <Link className="lp-linkChip" href="/lunsjordning">Lunsjordning for bedrifter</Link>
            <Link className="lp-linkChip" href="/hvordan">Slik fungerer det</Link>
            <Link className="lp-linkChip" href="/alternativ-til-kantine">Alternativ til kantine</Link>
            <Link className="lp-linkChip" href="/system-for-lunsjbestilling">System for lunsjbestilling</Link>
            <Link className="lp-linkChip" href="/lunsj-levering-oslo">Lunsjordning i Oslo</Link>
            <Link className="lp-linkChip" href="/lunsjordning-trondheim">Lunsjordning i Trondheim</Link>
            <Link className="lp-linkChip" href="/lunch-levering-bergen">Lunsjordning i Bergen</Link>
            <Link className="lp-linkChip" href="/definitiv-guide-firmalunsj">Definitiv guide til firmalunsj</Link>
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
                  <span className="lp-faqPlus" aria-hidden="true" />
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
