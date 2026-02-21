import "server-only";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { faqForPage } from "@/lib/seo/faq";
import { getMarketingPage } from "@/lib/seo/marketingRegistry";
import { createPageMetadata } from "@/lib/seo/meta";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, organizationJsonLd, webPageJsonLd } from "@/lib/seo/jsonld";
import { absoluteUrl, canonicalForPath } from "@/lib/seo/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PATH = "/lunsjordning";

export async function generateMetadata(): Promise<Metadata> {
  const entry = getMarketingPage(PATH);
  return createPageMetadata(entry);
}

export default function Page() {
  const entry = getMarketingPage(PATH);
  const faqItems = entry.faqKey ? faqForPage(entry.faqKey) : [];

  const canonical = canonicalForPath(entry.path);

  const pageJsonLd =
    entry.pageType === "article"
      ? articleJsonLd({
          url: canonical,
          headline: entry.title,
          description: entry.description,
          image: absoluteUrl(entry.ogImage),
        })
      : webPageJsonLd({
          url: canonical,
          name: entry.title,
          description: entry.description,
        });

  const breadcrumbJson = breadcrumbJsonLd(
    entry.breadcrumbs.map((item) => ({
      name: item.name,
      item: absoluteUrl(item.item),
    }))
  );

  const organizationJson = organizationJsonLd();
  const faqJson = faqItems.length ? faqJsonLd(faqItems) : null;

  const primaryCta = entry.primaryCta ?? { href: "/registrering", label: "Registrer firma" };
  const secondaryCta = entry.secondaryCta ?? { href: "/kontakt", label: "Kontakt oss" };

  return (
    <main className="lp-home lp-lunsjordning">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJson) }}
      />
      {faqJson ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson) }}
        />
      ) : null}

      <section className="lp-hero">
        <div className="lp-heroMedia" aria-hidden="true">
          <Image src="/matbilder/MelhusCatering-Lunsj-1018015.jpg" alt="" fill priority sizes="100vw" className="lp-heroImg" />
          <div className="lp-heroShade" />
        </div>

        <div className="lp-container lp-heroSplit">
          <div className="lp-heroCopy">
            <div className="lp-kicker">Lunsjordning</div>
            <h1 className="lp-heroTitle">Lunsjordning for bedrifter som vil ha ro i hverdagen</h1>
            <p className="lp-heroLead">
              Lunchportalen gjør firmalunsj enkel å styre. Bedriften setter rammene, ansatte bestiller innenfor
              rammene, og dagen låses ved cut-off kl. 08:00.
            </p>
            <ul className="lp-heroBullets" aria-label="Fordeler med modellen">
              <li>Tydelige rammer for hele bedriften</li>
              <li>Mindre daglig koordinering for admin</li>
              <li>Forutsigbar lunsjflyt uten støy</li>
            </ul>
            <div className="lp-heroActions">
              <Link className="lp-btn lp-btn-primary" href={primaryCta.href}>
                {primaryCta.label}
              </Link>
              <Link className="lp-btn lp-btn-ghost" href={secondaryCta.href}>
                {secondaryCta.label}
              </Link>
            </div>
          </div>

          <aside className="lp-heroPanel" aria-label="Neste steg">
            <div className="lp-panelCard">
              <div className="lp-panelTitle">Neste steg for bedriften</div>
              <div className="lp-panelActions">
                <Link className="lp-btn lp-btn-primary lp-btn-block" href="/system-for-lunsjbestilling">
                  System for lunsjbestilling
                </Link>
                <Link className="lp-btn lp-btn-ghost lp-btn-block" href="/hvordan">
                  Slik fungerer det
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="lp-section" aria-label="Interne lenker">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Relaterte sider</h2>
            <p className="lp-sub">Disse sidene hjelper dere å vurdere modell, oppstart og videre drift.</p>
          </div>
          <div className="lp-linkChips" aria-label="Relaterte sider">
            <Link className="lp-linkChip" href="/priser">
              Priser
            </Link>
            <Link className="lp-linkChip" href="/registrering">
              Registrering
            </Link>
            <Link className="lp-linkChip" href="/hvordan">
              Hvordan
            </Link>
            <Link className="lp-linkChip" href="/alternativ-til-kantine">
              Alternativ til kantine
            </Link>
            <Link className="lp-linkChip" href="/definitiv-guide-firmalunsj">
              Definitiv guide firmalunsj
            </Link>
            <Link className="lp-linkChip" href="/kontakt">
              Kontakt
            </Link>
          </div>
        </div>
      </section>

      {faqItems.length ? (
        <section id="faq" className="lp-section alt" aria-label="Spørsmål og svar">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2 className="lp-h2">Spørsmål og svar</h2>
              <p className="lp-sub">Svarene under er de samme som brukes i strukturert data.</p>
            </div>
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
      ) : null}
    </main>
  );
}
