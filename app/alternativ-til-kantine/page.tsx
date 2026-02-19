// app/alternativ-til-kantine/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Alternativ til kantine â€“ kontroll uten kjÃ¸kkeninvestering",
  description:
    "Alternativ til kantine uten kjÃ¸kkeninvestering: fast ramme, selvbetjening fÃ¸r kl. 08:00 og tydelig kontroll for admin. Et driftbart alternativ til kantinedrift.",
  alternates: { canonical: "/alternativ-til-kantine" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Alternativ til kantine â€“ kontroll uten kantinedrift",
    description:
      "Fast ramme. Cut-off kl. 08:00. Ã‰n sannhetskilde. Mindre drift og mindre risiko â€“ uten tradisjonell kantinedrift.",
    url: "/alternativ-til-kantine",
    type: "website",
    images: [
      {
        url: "/matbilder/MelhusCatering-Lunsj-1018016.jpg",
        width: 1200,
        height: 630,
        alt: "Lunsj â€“ alternativ til kantine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alternativ til kantine â€“ kontroll uten kantinedrift",
    description: "Fast ramme. Cut-off 08:00. Ã‰n sannhetskilde. Et driftbart alternativ til kantine.",
    images: ["/matbilder/MelhusCatering-Lunsj-1018016.jpg"],
  },
};

const FAQ = [
  {
    q: "Hva betyr Â«kantine uten kjÃ¸kkenÂ»?",
    a: "Det betyr at dere kan tilby sosial lunsj uten Ã¥ bygge og drifte eget kjÃ¸kken. Lunsjen leveres fra eksternt kjÃ¸kken, mens dere fÃ¥r en digital flyt med rammer, cut-off og kontroll.",
  },
  {
    q: "Er dette billigere enn tradisjonell kantine?",
    a: "Ofte, ja â€“ fordi dere unngÃ¥r investering i kjÃ¸kken, bemanning og intern drift. Modellen gir forutsigbar kost per kuvert og lavere administrasjon.",
  },
  {
    q: "Hvordan fÃ¥r vi kontroll pÃ¥ kostnad og svinn?",
    a: "Cut-off kl. 08:00 gir presis produksjon. Ansatte kan avbestille fÃ¸r cut-off, og systemet lÃ¥ser dagen etter 08:00 for Ã¥ unngÃ¥ avvik og matsvinn.",
  },
  {
    q: "Passer dette for kontorfellesskap og nÃ¦ringsbygg?",
    a: "Ja. Modellen egner seg godt der man Ã¸nsker en sosial lunsjflate uten kantineinvestering. Admin setter rammer for firma/lokasjoner, ansatte selvbetjener.",
  },
  {
    q: "Kan ansatte fÃ¥ individuelle unntak?",
    a: "Nei. Modellen fungerer fordi rammene er faste og felles. Systemet er Ã©n sannhetskilde â€“ uten manuelle unntak som skaper stÃ¸y og avvik.",
  },
];

function jsonLd() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Forside", item: "/" },
      { "@type": "ListItem", position: 2, name: "Alternativ til kantine", item: "/alternativ-til-kantine" },
    ],
  };

  return JSON.stringify([breadcrumbLd, faqLd]);
}

const BASIS_CHIPS = [
  "Salatbar",
  "PÃ¥smurt",
  "Varmmat",
  "Faste rammer (admin)",
  "Cut-off kl. 08:00",
  "Forutsigbar drift",
];

const LUXUS_CHIPS = ["Salatbar", "PÃ¥smurt", "Varmmat", "Sushi", "PokÃ©bowl", "Thaimat"];

export default function Page() {
  return (
    <main className="lp-home lp-altkantine">
      <script id="ld-altkantine" type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />

      {/* =========================================================
         HERO (URÃ˜RT)
      ========================================================= */}
      <section className="lp-hero">
        <div className="lp-heroMedia" aria-hidden="true">
          <Image
            src="/matbilder/MelhusCatering-Lunsj-1018016.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="lp-heroImg"
          />
          <div className="lp-heroShade" />
        </div>

        <div className="lp-container lp-heroSplit">
          {/* Left */}
          <div className="lp-heroCopy">
            <div className="lp-kicker">Alternativ til kantine</div>

            <h1 className="lp-heroTitle">Kontroll uten kantinedrift</h1>

            <p className="lp-heroLead">
              For bedrifter og nÃ¦ringsbygg som vil ha lunsj pÃ¥ jobb uten Ã¥ bygge og drifte kantine. Dere fÃ¥r fast ramme,
              selvbetjening og tydelig kontroll â€“ uten bemanning og uten manuelle unntak.
            </p>

            <ul className="lp-heroBullets" aria-label="Hovedpunkter">
              <li>Uten kjÃ¸kkeninvestering â€“ lunsj leveres fra eksternt kjÃ¸kken</li>
              <li>Cut-off kl. 08:00 gir presis produksjon og mindre svinn</li>
              <li>Ã‰n sannhetskilde: admin setter rammer â€“ ansatte selvbetjener</li>
            </ul>

            <div className="lp-heroActions">
              <Link className="lp-btn lp-btn-primary" href="/registrering">
                Registrer firma
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/hvordan">
                Se hvordan det fungerer
              </Link>
            </div>

            <div className="lp-heroNote">Avtale fÃ¸rst. Tydelige regler. Ingen manuelle unntak.</div>
          </div>

          {/* Right: glassboks */}
          <aside className="lp-heroPanel" aria-label="Kontrollpanel">
            <div className="lp-panelCard">
              <div className="lp-panelTitle">Hvorfor dette fungerer</div>

              <div className="lp-panelGrid">
                <div className="lp-panelItem">
                  <div className="lp-panelH">Ã‰n sannhetskilde</div>
                  <div className="lp-panelP">Data i portalen er fasit â€“ uten manuell overstyring.</div>
                </div>

                <div className="lp-panelItem">
                  <div className="lp-panelH">08:00 cut-off</div>
                  <div className="lp-panelP">Gir presis produksjon og mindre svinn.</div>
                </div>

                <div className="lp-panelItem">
                  <div className="lp-panelH">Admin-kontroll</div>
                  <div className="lp-panelP">Bedriften styrer rammer, ikke daglige avvik.</div>
                </div>

                <div className="lp-panelItem">
                  <div className="lp-panelH">Skalerbart</div>
                  <div className="lp-panelP">Fungerer for bygg, kontorfellesskap og konsern.</div>
                </div>
              </div>

              <div className="lp-panelActions">
                <Link className="lp-btn lp-btn-primary lp-btn-block" href="/system-for-lunsjbestilling">
                  Se bestillingssystemet
                </Link>
                <Link className="lp-btn lp-btn-ghost lp-btn-block" href="#pris">
                  Se prisnivÃ¥ (Basis / Luxus)
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* =========================================================
         OUTSOURCE / HVA-HVORFOR-HVORDAN (FULL WIDTH BODY)
         (Ingen ekstra "Registrer firma" her)
      ========================================================= */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Hva betyr Â«outsource kantineÂ»?</h2>
            <p className="lp-sub">
              En moderne lÃ¸sning handler om flyt â€“ ikke kjÃ¸kken. Admin setter rammene, ansatte bestiller selv.
            </p>
          </div>

          <div className="lp-cards3">
            <div className="lp-card soft lp-card-pad">
              <h3 className="lp-h3">Hva</h3>
              <p className="lp-p">
                Lunsj uten kantinedrift. Dere slipper tradisjonell kantinebemanning og intern kjÃ¸kkenlogistikk.
              </p>
            </div>

            <div className="lp-card soft lp-card-pad">
              <h3 className="lp-h3">Hvorfor</h3>
              <p className="lp-p">
                Lavere investering og mindre drift â€“ samtidig som dere fÃ¥r ro, kontroll og forutsigbar kost.
              </p>
            </div>

            <div className="lp-card soft lp-card-pad">
              <h3 className="lp-h3">Hvordan</h3>
              <p className="lp-p">Cut-off kl. 08:00 + avtale pÃ¥ firmanivÃ¥ gir presisjon og fÃ¦rre avvik.</p>
            </div>
          </div>

          <div className="lp-cta-row">
            <Link className="lp-btn lp-btn-ghost" href="/system-for-lunsjbestilling">
              Se bestillingssystemet
            </Link>
            <Link className="lp-btn lp-btn-ghost" href="/lunsjordning">
              Les om lunsjordning
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================
         PRIS (FULL WIDTH BODY)
         (Knappetekst endret -> ikke 8x "Registrer firma")
      ========================================================= */}
      <section id="pris" className="lp-section alt">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Basis og Luxus</h2>
            <p className="lp-sub">Tydelig avtale â€“ uten stÃ¸y. Firma-admin velger nivÃ¥ og leveringsdager.</p>
          </div>

          <div className="lp-pricing">
            <div className="lp-card pricing">
              <div className="lp-pill">Basis</div>

              <div className="lp-price">
                <span className="lp-price-n">90</span>
                <span className="lp-price-s">kr / kuvert</span>
              </div>

              <ul className="lp-list">
                {BASIS_CHIPS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>

              <Link className="lp-btn lp-btn-primary lp-btn-block" href="/registrering">
                Velg Basis â†’
              </Link>
            </div>

            <div className="lp-card pricing featured">
              <div className="lp-pill hot">Luxus</div>

              <div className="lp-price">
                <span className="lp-price-n">130</span>
                <span className="lp-price-s">kr / kuvert</span>
              </div>

              <ul className="lp-list">
                {LUXUS_CHIPS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>

              <Link className="lp-btn lp-btn-primary lp-btn-block" href="/registrering">
                Velg Luxus â†’
              </Link>
            </div>
          </div>

          <div className="lp-linkChips" aria-label="Lokale sider">
            <Link className="lp-linkChip" href="/lunsj-levering-oslo">
              Lunsj levering Oslo
            </Link>
            <Link className="lp-linkChip" href="/lunch-levering-bergen">
              Lunch levering Bergen
            </Link>
            <Link className="lp-linkChip" href="/lunsjordning-trondheim">
              Lunsjordning Trondheim
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================
         FAQ (FULL WIDTH BODY)
         (Ingen ekstra "Registrer firma" her)
      ========================================================= */}
      <section className="lp-section" aria-label="SpÃ¸rsmÃ¥l og svar">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Kort og tydelig</h2>
            <p className="lp-sub">Svar pÃ¥ det viktigste â€“ uten omveier.</p>
          </div>

          <div className="lp-faq lp-faq--premium">
            {FAQ.map((x) => (
              <details className="lp-faq-item" key={x.q}>
                <summary className="lp-faq-q">
                  <span>{x.q}</span>
                  <span className="lp-faq-icon" aria-hidden="true" />
                </summary>
                <div className="lp-faq-a">{x.a}</div>
              </details>
            ))}
          </div>

          <div className="lp-cta-row">
            <Link className="lp-btn lp-btn-ghost" href="/hvordan">
              Se hvordan det fungerer
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================
         SLUTT-CTA (FULL WIDTH BODY)
         (1 tydelig "Registrer firma" her â€“ ferdig)
      ========================================================= */}
      <section className="lp-section alt">
        <div className="lp-container">
          <div className="lp-final-cta">
            <h2 className="lp-h2" style={{ marginBottom: 8 }}>
              Klar for kontroll uten kantinedrift?
            </h2>
            <p className="lp-sub" style={{ marginBottom: 16 }}>
              Registrer firma â€“ sÃ¥ tar dere neste steg med tydelige rammer, fast pris og en modell som fungerer i drift.
            </p>
            <div className="lp-cta-row">
              <Link className="lp-btn lp-btn-primary lp-neon" href="/registrering">
                Registrer firma
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/system-for-lunsjbestilling">
                Se bestillingssystemet
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

