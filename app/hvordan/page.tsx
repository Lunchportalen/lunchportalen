// app/hvordan/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import RelatedLinks from "@/components/seo/RelatedLinks";
import { organizationJsonLd, webPageJsonLd } from "@/lib/seo/jsonld";
import { canonicalForPath } from "@/lib/seo/site";

// ✅ Client component for safe computed styles (no SSR crash)
import ComputedDivider from "@/components/ComputedDivider";

export const metadata: Metadata = {
  title: "Slik fungerer Lunchportalen – avtale, onboarding, bestilling og cut-off 08:00",
  description:
    "Se nøyaktig hvordan Lunchportalen fungerer – fra avtale og onboarding til bestilling, cut-off kl. 08:00 og kjøkkenflyt. Én sannhetskilde, null manuelle unntak.",
  alternates: { canonical: "/hvordan" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Slik fungerer Lunchportalen",
    description:
      "Avtale først. Cut-off kl. 08:00. Verifisert lagring. Kjøkkenflyt. Driftssikkerhet. Se hele modellen.",
    type: "website",
    url: "https://lunchportalen.no/hvordan",
  },
};

const FAQ = [
  {
    q: "Hva er Lunchportalen?",
    a: "Lunchportalen er en digital lunsjplattform og et bestillingssystem for lunsj til ansatte. Admin setter avtalerammer, ansatte bestiller selv innenfor rammene – uten manuell oppfølging.",
  },
  {
    q: "Hvorfor er cut-off kl. 08:00 viktig?",
    a: "Cut-off kl. 08:00 (Europe/Oslo) gjør at produksjon og levering kan planlegges presist. Det reduserer matsvinn og gir forutsigbar drift for både bedrift og kjøkken.",
  },
  {
    q: "Hvem oppretter brukere?",
    a: "Firma/admin oppretter og administrerer ansatte i portalen. Ansatte har selvbetjening, men bedriften eier rammene og avtalen.",
  },
  {
    q: "Hvordan unngår dere at noen tror noe er registrert uten at det er lagret?",
    a: "UI bekrefter kun når lagring er verifisert. Handlinger er idempotente, og systemet kan sende e-post-backup via outbox + retry for driftssikkerhet.",
  },
  {
    q: "Hvordan ser kjøkkenflyten ut?",
    a: "Bestillinger grupperes per leveringsvindu → firma → lokasjon → ansatt, klart for produksjon og utskrift/eksport.",
  },
] as const;

function faqJsonLd() {
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

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M20 6L9 17l-5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path
        d="M12 6v6l4 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2l8 4v6c0 5-3.5 9.7-8 10-4.5-.3-8-5-8-10V6l8-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HvordanDetFungererPage() {
  const jsonld = [
    organizationJsonLd(),
    webPageJsonLd({
      url: canonicalForPath("/hvordan"),
      name: "Slik fungerer Lunchportalen – avtale, onboarding, bestilling og cut-off 08:00",
      description:
        "Se nøyaktig hvordan Lunchportalen fungerer – fra avtale og onboarding til bestilling, cut-off kl. 08:00 og kjøkkenflyt.",
      inLanguage: "nb-NO",
    }),
  ];

  return (
    <>
      {/* JSON-LD: Org + Website */}
      <script
        id="jsonld-how-core"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }}
      />

      {/* JSON-LD: FAQ */}
      <script
        id="jsonld-how-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd() }}
      />

      {/* =========================================================
         HERO — IDENTISK STRUKTUR SOM /LUNSJORDNING
      ========================================================= */}
      <section className="lp-hero lp-fullbleed lp-how-page" aria-label="Slik fungerer Lunchportalen">
        <div className="lp-heroMedia" aria-hidden="true">
          <Image
            src="/matbilder/MelhusCatering-Lunsj-1018016.jpg"
            alt=""
            fill
            priority
            className="lp-heroImg"
            sizes="100vw"
          />
          <div className="lp-heroShade" />
        </div>

        <div className="lp-container lp-heroSplit">
          {/* Left */}
          <div className="lp-heroCopy">
            <div className="lp-kicker">Hvordan</div>

            <h1 className="lp-heroTitle">Slik fungerer Lunchportalen</h1>

            <p className="lp-heroLead">
              Modellen er laget for bedrifter som vil ha kontroll og forutsigbarhet: avtalerammer først, selvbetjening
              for ansatte – og produksjon som kan planlegges presist.
            </p>

            <ul className="lp-heroBullets" aria-label="Hovedpunkter">
              <li>Én sannhetskilde – tydelige regler og færre avvik</li>
              <li>Cut-off kl. 08:00 gir presis produksjon og mindre svinn</li>
              <li>Bekreftelse først når lagring er verifisert</li>
            </ul>

            <div className="lp-heroActions">
              <Link className="lp-btn lp-btn-primary" href="/registrering">
                Registrer firma
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/lunsjordning">
                Les om lunsjordning
              </Link>
            </div>

            <div className="lp-heroNote">Avtale først. Tydelige regler. Ingen manuelle unntak.</div>
          </div>

          {/* Right — glasspanel */}
          <aside className="lp-heroPanel" aria-label="Kontroll i drift">
            <div className="lp-panelCard">
              <div className="lp-panelTitle">Dette gir kontroll i drift</div>

              <div className="lp-panelGrid">
                <div className="lp-panelItem">
                  <div className="lp-panelH">Avtale &amp; rammer</div>
                  <div className="lp-panelP">Nivå, dager, pris og rammer settes før noe kan bestilles.</div>
                </div>

                <div className="lp-panelItem">
                  <div className="lp-panelH">Selvbetjening</div>
                  <div className="lp-panelP">Ansatte bestiller/avbestiller innenfor rammene – frem til kl. 08:00.</div>
                </div>

                <div className="lp-panelItem">
                  <div className="lp-panelH">Verifisert → kjøkkenliste</div>
                  <div className="lp-panelP">Etter cut-off låses dagen og grupperes klart for produksjon og levering.</div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <ComputedDivider
                  cssVar="--lp-divider-rgb"
                  alpha={0.10}
                  fallback="rgba(255,255,255,0.14)"
                  className="rounded-full"
                />
              </div>

              <div className="lp-proof" style={{ marginTop: 14 }} aria-label="System proof">
                <span className="lp-proof-chip">
                  <IconCheck /> LAGRET: 07:42
                </span>
                <span className="lp-proof-chip">
                  <IconClock /> CUTOFF: 08:00
                </span>
                <span className="lp-proof-chip">
                  <IconShield /> STATUS: ACTIVE
                </span>
                <span className="lp-proof-chip lp-proof-chip--rid">RID: 8F3K…</span>
              </div>

              <div className="lp-panelActions" style={{ marginTop: 14 }}>
                <Link className="lp-btn lp-btn-primary lp-btn-block" href="/system-for-lunsjbestilling">
                  Se bestillingssystemet
                </Link>
                <Link className="lp-btn lp-btn-ghost lp-btn-block" href="/alternativ-til-kantine">
                  Alternativ til kantine
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* WHAT / WHY / HOW */}
      <section className="lp-section" aria-label="Hva, hvorfor og hvordan">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Hva er det – og hvorfor fungerer det?</h2>
            <p className="lp-sub">
              En rolig “command center”-modell: admin setter rammene, ansatte betjener seg selv. Det gir mindre
              administrasjon, mindre svinn – og mer presisjon i produksjon.
            </p>
          </div>

          <div className="lp-cards3">
            <div className="lp-card soft lp-card-pad">
              <h3>Hva</h3>
              <p className="lp-muted" style={{ marginTop: 8 }}>
                Digital lunsjplattform med status, kvittering og avtalerammer – uten supportkaos.
              </p>
            </div>

            <div className="lp-card soft lp-card-pad">
              <h3>Hvorfor</h3>
              <p className="lp-muted" style={{ marginTop: 8 }}>
                Cut-off 08:00 gir presis produksjon. Én sannhetskilde fjerner misforståelser. Ingen manuelle unntak.
              </p>
            </div>

            <div className="lp-card soft lp-card-pad">
              <h3>Hvordan</h3>
              <p className="lp-muted" style={{ marginTop: 8 }}>
                Avtale → onboarding → selvbetjening → verifisert lagring → kjøkkenflyt → driftssikkerhet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TIMELINE — THE ENGINE */}
      <section className="lp-section alt" aria-label="Slik går en uke">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Slik går en uke – uten overraskelser</h2>
            <p className="lp-sub">
              Dette er rytmen som gjør at systemet kan levere stabilt – og at kjøkkenet får tall som faktisk stemmer.
            </p>
          </div>

          <div className="lp-timeline">
            <div className="lp-timeline-item">
              <div className="lp-timeline-dot lp-active-ring" aria-hidden="true" />
              <div className="lp-timeline-body">
                <div className="lp-timeline-title">Torsdag 08:00</div>
                <div className="lp-muted">Neste uke åpner for forhåndsvisning/bestilling (der det er avtalt).</div>
              </div>
            </div>

            <div className="lp-timeline-item">
              <div className="lp-timeline-dot" aria-hidden="true" />
              <div className="lp-timeline-body">
                <div className="lp-timeline-title">Hver leveringsdag</div>
                <div className="lp-muted">Ansatte kan bestille/avbestille frem til cut-off (samme dag).</div>
              </div>
            </div>

            <div className="lp-timeline-item">
              <div className="lp-timeline-dot lp-active-ring" aria-hidden="true" />
              <div className="lp-timeline-body">
                <div className="lp-timeline-title">Cut-off kl. 08:00 (Europe/Oslo)</div>
                <div className="lp-muted">Etter 08:00 låses dagen for produksjon. Systemet “fail-closed”.</div>
              </div>
            </div>

            <div className="lp-timeline-item">
              <div className="lp-timeline-dot" aria-hidden="true" />
              <div className="lp-timeline-body">
                <div className="lp-timeline-title">Kjøkkenflyt</div>
                <div className="lp-muted">
                  Gruppering per leveringsvindu → firma → lokasjon → ansatt (klar for utskrift/eksport).
                </div>
              </div>
            </div>

            <div className="lp-timeline-item">
              <div className="lp-timeline-dot" aria-hidden="true" />
              <div className="lp-timeline-body">
                <div className="lp-timeline-title">Kvittering &amp; driftssikkerhet</div>
                <div className="lp-muted">
                  Bekreftelse først når lagring er verifisert. Backup/outbox + retry ved behov.
                </div>
              </div>
            </div>
          </div>

          <div className="lp-cta-row" style={{ marginTop: 18 }}>
            <Link className="lp-btn lp-btn-primary" href="/registrering">
              Registrer firma
            </Link>
            <Link className="lp-btn lp-btn-ghost" href="/alternativ-til-kantine">
              Se alternativ til kantine
            </Link>
          </div>
        </div>
      </section>

      {/* HOW: 6 steg (zig-zag) */}
      <section className="lp-section" aria-label="Steg for steg">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Steg for steg – slik skjer det i systemet</h2>
            <p className="lp-sub">Flyten som gjør drift forutsigbar: samme regler, samme sannhetskilde – hver dag.</p>
          </div>

          <div className="lp-zig">
            {/* 1 */}
            <div className="lp-zig-row">
              <div className="lp-zig-text">
                <div className="lp-zig-step">
                  <span className="lp-neon-ring">1</span>
                  <div>
                    <h3>Avtale først</h3>
                    <p className="lp-muted" style={{ marginTop: 8 }}>
                      Firma registrerer interesse. Avtale aktiveres med nivå, dager og rammer. Ingen bestilling før
                      avtalen er aktiv.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lp-zig-media">
                <div className="lp-media-card">
                  <Image
                    src="/matbilder/MelhusCatering-Lunsj-1017985.jpg"
                    alt="Bedriftslunsj med strukturert avtale"
                    width={1200}
                    height={900}
                    className="lp-section-img"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>

            {/* 2 */}
            <div className="lp-zig-row is-reverse">
              <div className="lp-zig-text">
                <div className="lp-zig-step">
                  <span className="lp-neon-ring">2</span>
                  <div>
                    <h3>FirmaAdmin legger til ansatte</h3>
                    <p className="lp-muted" style={{ marginTop: 8 }}>
                      FirmaAdmin oppretter brukere internt. Ansatte får selvbetjening innenfor rammene – admin slipper
                      ansatt-support.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lp-zig-media">
                <div className="lp-media-card">
                  <Image
                    src="/matbilder/MelhusCatering-Lunsj-1018001.jpg"
                    alt="Lunsj til ansatte – selvbetjening innenfor rammer"
                    width={1200}
                    height={900}
                    className="lp-section-img"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>

            {/* 3 */}
            <div className="lp-zig-row">
              <div className="lp-zig-text">
                <div className="lp-zig-step">
                  <span className="lp-neon-ring">3</span>
                  <div>
                    <h3>Bestill / avbestill (cut-off 08:00)</h3>
                    <p className="lp-muted" style={{ marginTop: 8 }}>
                      Endringer er tillatt frem til kl. 08:00 (Europe/Oslo). Etter cut-off er dagen låst for produksjon
                      og levering.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lp-zig-media">
                <div className="lp-media-card">
                  <Image
                    src="/matbilder/MelhusCatering-Lunsj-1018019.jpg"
                    alt="Bestillingssystem for lunsj med cut-off 08:00"
                    width={1200}
                    height={900}
                    className="lp-section-img"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>

            {/* 4 */}
            <div className="lp-zig-row is-reverse">
              <div className="lp-zig-text">
                <div className="lp-zig-step">
                  <span className="lp-neon-ring">4</span>
                  <div>
                    <h3>Kvittering + verifisert lagring</h3>
                    <p className="lp-muted" style={{ marginTop: 8 }}>
                      UI bekrefter først når lagring er verifisert. Handlinger er idempotente og kan kvitteres med
                      orderId, status og tidspunkt.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lp-zig-media">
                <div className="lp-media-card">
                  <Image
                    src="/matbilder/MelhusCatering-Lunsj-1018038.jpg"
                    alt="Verifisert lagring og kvittering"
                    width={1200}
                    height={900}
                    className="lp-section-img"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>

            {/* 5 */}
            <div className="lp-zig-row">
              <div className="lp-zig-text">
                <div className="lp-zig-step">
                  <span className="lp-neon-ring">5</span>
                  <div>
                    <h3>Kjøkkenflyt</h3>
                    <p className="lp-muted" style={{ marginTop: 8 }}>
                      Bestillinger grupperes per leveringsvindu → firma → lokasjon → ansatt, klart for produksjon og
                      utskrift/eksport.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lp-zig-media">
                <div className="lp-media-card">
                  <Image
                    src="/matbilder/MelhusCatering-Lunsj-1018047.jpg"
                    alt="Kjøkkenflyt og gruppering per leveringsvindu"
                    width={1200}
                    height={900}
                    className="lp-section-img"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>

            {/* 6 */}
            <div className="lp-zig-row is-reverse">
              <div className="lp-zig-text">
                <div className="lp-zig-step">
                  <span className="lp-neon-ring">6</span>
                  <div>
                    <h3>Driftssikkerhet</h3>
                    <p className="lp-muted" style={{ marginTop: 8 }}>
                      Backup/outbox + retry gjør at ingen kan få “falsk bekreftelse”. Systemet er én sannhetskilde.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lp-zig-media">
                <div className="lp-media-card">
                  <Image
                    src="/matbilder/MelhusCatering-Lunsj-1018059.jpg"
                    alt="Driftssikkerhet og backup"
                    width={1200}
                    height={900}
                    className="lp-section-img"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="lp-cta-row" style={{ marginTop: 18 }}>
            <Link className="lp-btn lp-btn-primary" href="/registrering">
              Registrer firma
            </Link>
            <Link className="lp-btn lp-btn-ghost" href="/lunsjordning">
              Les om lunsjordning
            </Link>
            <Link className="lp-btn lp-btn-ghost" href="/alternativ-til-kantine">
              Alternativ til kantine
            </Link>
          </div>
        </div>
      </section>

      {/* SXO — premium two-card module */}
      <section className="lp-section alt" aria-label="Lokalt og SXO">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Prisnivå og lokalt (SXO)</h2>
            <p className="lp-sub">
              I avtalen settes nivå (Basis/Luxus) og leveringsdager. Samme modell – samme kontroll – uansett lokasjon.
            </p>
          </div>

          <div className="lp-sxo-grid">
            <div className="lp-card soft lp-card-pad">
              <h3>Modell &amp; prisnivå</h3>
              <p className="lp-muted" style={{ marginTop: 8 }}>
                Basis og Luxus defineres i avtalen. Firma/admin eier rammene – ansatte bruker selvbetjening innenfor
                avtalte regler.
              </p>
              <div className="lp-proof" style={{ marginTop: 12 }}>
                <span className="lp-proof-chip">
                  <IconClock /> Cut-off: 08:00
                </span>
                <span className="lp-proof-chip">
                  <IconCheck /> Verifisert lagring
                </span>
              </div>
            </div>

            <div className="lp-card soft lp-card-pad">
              <h3>Lokale sider</h3>
              <p className="lp-muted" style={{ marginTop: 8 }}>
                Brukes som landingssider for lokalt søk – uten at modellen endrer seg.
              </p>
              <div className="lp-cta-row" style={{ marginTop: 12 }}>
                <Link className="lp-btn lp-btn-ghost" href="/lunsj-levering-oslo">
                  Lunsj levering Oslo
                </Link>
                <Link className="lp-btn lp-btn-ghost" href="/lunsjordning-trondheim">
                  Lunsjordning Trondheim
                </Link>
                <Link className="lp-btn lp-btn-ghost" href="/lunch-levering-bergen">
                  Lunch levering Bergen
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — premium accordion */}
      <section className="lp-section" style={{ paddingTop: 36 }} aria-label="FAQ">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Spørsmål og svar</h2>
            <p className="lp-sub">Kort og tydelig – uten støy.</p>
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
        </div>
      </section>

      <RelatedLinks currentPath="/hvordan" tags={["how", "core", "seo", "system", "alt_kantine", "local"]} />

      {/* FINAL CTA */}
      <section className="lp-section" style={{ paddingTop: 38 }} aria-label="CTA">
        <div className="lp-container">
          <div className="lp-final-cta">
            <h2 className="lp-h2" style={{ marginBottom: 8 }}>
              Klar for en modell som bare fungerer?
            </h2>
            <p className="lp-sub" style={{ marginBottom: 16 }}>
              Registrer firma og få en driftbar lunsjflyt med cut-off 08:00, verifisert lagring og full oversikt.
            </p>
            <div className="lp-cta-row">
              <Link className="lp-btn lp-btn-primary" href="/registrering">
                Registrer firma
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/">
                Tilbake til forsiden
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

