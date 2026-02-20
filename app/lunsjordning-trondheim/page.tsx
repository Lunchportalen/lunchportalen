// app/lunsjordning-trondheim/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Lunsjordning Trondheim – lunsj til ansatte med fast ramme og lav administrasjon",
  description:
    "Lunsjordning Trondheim: lunsj til ansatte med fast ramme, bestilling før kl. 08:00, mindre matsvinn og tydelige rammer. Et moderne alternativ til kantine.",
  alternates: { canonical: '/lunsjordning-trondheim' },
  robots: { index: true, follow: true },
};

const FAQ = [
  {
    q: "Hva er en lunsjordning i Trondheim?",
    a: "En fast og forutsigbar lunsjordning for bedrift – med tydelige rammer, enkel bestilling og mindre arbeid internt. Levering og oppstart avtales etter behov.",
  },
  {
    q: "Hvordan reduserer vi matsvinn?",
    a: "Når bestilling/avbestilling skjer innen fristen, blir planleggingen mer presis. Det gir bedre flyt – og mindre svinn.",
  },
  {
    q: "Hva er første steg?",
    a: "Be om tilbud. Vi avklarer behov, rammer og oppstart – og dere får en ordning som fungerer i hverdagen.",
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
            src="/matbilder/MelhusCatering-Lunsj-1018059.jpg"
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
              <span className="lp-chip">Lunsjordning</span>
              <span className="lp-chip">Trondheim</span>
              <span className="lp-chip">For bedrift</span>
            </div>

            <h1 className="lp-h1" style={{ marginBottom: 10 }}>
              Lunsjordning Trondheim
            </h1>

            <p className="lp-lead">
              En rolig og presis <strong>lunsjløsning</strong> for bedrifter: tydelige rammer, enkel bestilling
              og frist før <strong>kl. 08:00</strong>. Resultatet er mindre arbeid internt – og mindre svinn.
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
              <span className="lp-trust-item">✅ Forutsigbar modell</span>
              <span className="lp-trust-item">✅ Mindre svinn</span>
              <span className="lp-trust-item">✅ Tydelige rammer</span>
            </div>
          </div>

          {/* KORT FORTALT */}
          <div className="lp-mini-hero-card">
            <div className="lp-card">
              <div className="lp-card-title">Kort fortalt</div>

              <div className="lp-why-grid">
                <div className="lp-mini">
                  <div className="lp-mini-h">Lunsj til ansatte</div>
                  <div className="lp-mini-p">En fast ordning tilpasset arbeidshverdagen i Trondheim.</div>
                </div>
                <div className="lp-mini">
                  <div className="lp-mini-h">Mindre arbeid for admin</div>
                  <div className="lp-mini-p">Ansatte ordner bestilling selv – innen fristen.</div>
                </div>
                <div className="lp-mini">
                  <div className="lp-mini-h">Bedre flyt, mindre svinn</div>
                  <div className="lp-mini-p">Frist før kl. 08:00 gir bedre planlegging.</div>
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
            <h2 className="lp-h2">Prisnivå og avtale</h2>
            <p className="lp-sub">
              Rammene settes i avtalen. Mange velger en kombinasjon – for eksempel 4 dager Basis og 1 dag Luxus.
            </p>
          </div>

          {/* Diskrete lenker (ikke en ny “knappemeny”) */}
          <div style={{ marginTop: 14 }}>
            <p className="lp-sub" style={{ marginBottom: 10 }}>
              Vil dere se alternativer og detaljer før dere ber om tilbud?
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
            <h2 className="lp-h2">Spørsmål og svar</h2>
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

          {/* Kun én CTA her */}
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

