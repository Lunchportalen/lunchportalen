import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { faqForPage } from "@/lib/seo/faq";
import { getMarketingPage } from "@/lib/seo/marketingRegistry";
import { createPageMetadata } from "@/lib/seo/meta";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/seo/site";

const PATH = "/system-for-lunsjbestilling";

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata(getMarketingPage(PATH));
}

export default function Page() {
  const entry = getMarketingPage(PATH);
  const faqItems = entry.faqKey ? faqForPage(entry.faqKey) : [];

  const webJson = webPageJsonLd({
    url: absoluteUrl(entry.path),
    name: entry.title,
    description: entry.description,
  });

  const breadcrumbJson = breadcrumbJsonLd(
    entry.breadcrumbs.map((item) => ({
      name: item.name,
      item: absoluteUrl(item.item),
    }))
  );

  const faqJson = faqItems.length ? faqJsonLd(faqItems) : null;

  return (
    <main className="lp-home">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webJson) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }}
      />
      {faqJson ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson) }}
        />
      ) : null}

      <section className="lp-section">
        <div className="lp-container">
          <h1 className="lp-h1">System for lunsjbestilling</h1>
          <p className="lp-lead">
            Dette er en tydelig modell for firmalunsj. Bedriften setter rammene, ansatte bestiller innenfor rammene,
            og dagen låses kl. 08:00.
          </p>

          <div className="lp-actions" style={{ marginTop: 16 }}>
            <Link className="lp-btn lp-btn-primary" href="/registrering">
              Registrer firma
            </Link>
            <Link className="lp-btn lp-btn-ghost" href="/kontakt">
              Kontakt oss
            </Link>
          </div>

          <div className="lp-linkChips" style={{ marginTop: 20 }}>
            {entry.intentLinks.map((link) => (
              <Link className="lp-linkChip" href={link.href} key={`${link.href}-${link.label}`}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" aria-label="Relaterte sider">
        <div className="lp-container">
          <h2 className="lp-h2">Relaterte sider</h2>
          <div className="lp-linkChips" style={{ marginTop: 12 }}>
            <Link className="lp-linkChip" href="/sikkerhet">
              Sikkerhet
            </Link>
            <Link className="lp-linkChip" href="/personvern">
              Personvern
            </Link>
            <Link className="lp-linkChip" href="/vilkar">
              Vilkår
            </Link>
            <Link className="lp-linkChip" href="/priser">
              Priser
            </Link>
            <Link className="lp-linkChip" href="/registrering">
              Registrering
            </Link>
            <Link className="lp-linkChip" href="/kontakt">
              Kontakt
            </Link>
          </div>
        </div>
      </section>

      {faqItems.length ? (
        <section className="lp-section alt" aria-label="Spørsmål og svar">
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
      ) : null}
    </main>
  );
}
