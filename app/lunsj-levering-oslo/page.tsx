// app/lunsj-levering-oslo/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Lunsj levering Oslo â€“ lunsjordning for bedrift med kontroll og fast pris",
  description:
    "Lunsj levering Oslo: lunsjordning for bedrift med fast ramme, selvbetjening fÃ¸r kl. 08:00 og mindre matsvinn. Et moderne alternativ til kantine.",
  alternates: { canonical: '/lunsj-levering-oslo' },
  robots: { index: true, follow: true },
};

const FAQ = [
  {
    q: "Leverer dere lunsj i Oslo?",
    a: "Ja â€“ vi kan levere til bedrifter i Oslo. Leveringsopplegg og rammer avtales, slik at dere fÃ¥r en stabil ordning som passer arbeidshverdagen.",
  },
  {
    q: "Hva er viktigst i en lunsjordning for firma?",
    a: "Forutsigbarhet. Tydelige rammer, fast modell og enkel bestilling gir mindre arbeid internt â€“ og mindre svinn nÃ¥r bestilling skjer fÃ¸r kl. 08:00.",
  },
  {
    q: "Hvordan kommer vi i gang?",
    a: "Be om tilbud. Vi avklarer behov, rammer og oppstart â€“ og dere fÃ¥r en enkel hverdag der ansatte bestiller innen fristen.",
  },
];

function jsonLdFaq() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
  });
}

export default function Page() {
  return (
    <main className="lp-home">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLdFaq() }}
      />

      {/* HERO */}
      <section className="lp-mini-hero">
        <div className="lp-mini-hero-media" aria-hidden="true">
          <Image
            src="/matbilder/MelhusCatering-Lunsj-1018047.jpg"
            alt=""
            fill
            priority
            className="lp-mini-hero-img"
          />
          <div className="lp-mini-hero-overlay" />
        </div>

        <div className="lp-container lp-mini-hero-grid">
          <div className="lp-mini-hero-copy">
            <div className="lp-chip-row">
              <span className="lp-chip">Lunsj levering</span>
              <span className="lp-chip">Oslo</span>
              <span className="lp-chip">For bedrift</span>
            </div>

            <h1 className="lp-h1" style={{ marginBottom: 10 }}>
              Lunsj levering Oslo
            </h1>

            <p className="lp-lead">
              For bedrifter som Ã¸nsker <strong>lunsj til ansatte</strong> med tydelige rammer:
              forutsigbar modell, enkel bestilling og frist fÃ¸r <strong>kl. 08:00</strong>.
              Resultatet er mindre arbeid internt â€“ og mindre svinn.
            </p>

            <div className="lp-actions">
              <Link className="lp-btn lp-btn-primary lp-neon" href="/kontakt">
                Be om tilbud
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/hvordan">
                Slik fungerer det
              </Link>
            </div>

            <div className="lp-trust">
              <span className="lp-trust-item">âœ… Forutsigbar modell</span>
              <span className="lp-trust-item">âœ… Mindre svinn</span>
              <span className="lp-trust-item">âœ… Tydelige rammer</span>
            </div>
          </div>

          {/* KORT FORTALT */}
          <div className="lp-mini-hero-card">
            <div className="lp-card">
              <div className="lp-card-title">Kort fortalt</div>

              <div className="lp-why-grid">
                <div className="lp-mini">
                  <div className="lp-mini-h">Lunsj levert til bedrift</div>
                  <div className="lp-mini-p">Stabil ordning tilpasset arbeidshverdagen i Oslo.</div>
                </div>
                <div className="lp-mini">
                  <div className="lp-mini-h">Mindre arbeid for admin</div>
                  <div className="lp-mini-p">Ansatte ordner bestilling selv â€“ innen fristen.</div>
                </div>
                <div className="lp-mini">
                  <div className="lp-mini-h">Bedre flyt, mindre svinn</div>
                  <div className="lp-mini-p">Bestilling fÃ¸r kl. 08:00 gir bedre planlegging.</div>
                </div>
              </div>

              <div className="lp-divider" />
              <Link className="lp-btn lp-btn-primary lp-btn-block lp-neon" href="/hvordan">
                Se opplegget steg for steg
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PRIS / AVTALE */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">PrisnivÃ¥ og avtale</h2>
            <p className="lp-sub">
              Rammene settes i avtalen. Mange velger en kombinasjon â€“ for eksempel 4 dager Basis og 1 dag Luxus.
            </p>
          </div>

          {/* Ingen nye store knapper her â€“ bare stÃ¸tteinformasjon */}
          <div style={{ marginTop: 14 }}>
            <p className="lp-sub" style={{ marginBottom: 10 }}>
              Vil dere vurdere dette som erstatning for kantine, eller se hvordan det fungerer i praksis?
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link className="lp-link" href="/alternativ-til-kantine">
                Erstatt kantine
              </Link>
              <Link className="lp-link" href="/hvordan">
                Slik fungerer det
              </Link>
              <Link className="lp-link" href="/lunsjordning">
                Se ordningen
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section alt" style={{ paddingTop: 36 }}>
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">SpÃ¸rsmÃ¥l og svar</h2>
            <p className="lp-sub">Kort og tydelig.</p>
          </div>

          <div className="lp-faq">
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

          {/* Kun Ã©n CTA til, ikke dupliser hero */}
          <div className="lp-cta-row" style={{ justifyContent: "flex-start" }}>
            <Link className="lp-btn lp-btn-primary lp-neon" href="/kontakt">
              Be om tilbud
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

