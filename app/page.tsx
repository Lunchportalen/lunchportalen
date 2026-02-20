// app/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import PageShell from "@/components/PageShell";
import Hero from "@/components/Hero";

import RelatedLinks from "@/components/seo/RelatedLinks";
import { organizationJsonLd, webPageJsonLd } from "@/lib/seo/jsonld";
import { canonicalForPath } from "@/lib/seo/site";

// ✅ client component (computed)
import ComputedDivider from "@/components/ComputedDivider";

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

const HERO_IMAGES = [
  "/matbilder/MelhusCatering-Lunsj-1018016.jpg",
  "/matbilder/MelhusCatering-Lunsj-1018015.jpg",
  "/matbilder/melhuscatering-lunsj-1018029.jpg",
];

export default function MarketingHome() {
  const jsonld = [
    organizationJsonLd(),
    webPageJsonLd({
      url: canonicalForPath("/"),
      name: "Lunchportalen – firmalunsj med kontroll og forutsigbarhet",
      description:
        "Bestill og administrer firmalunsj med faste rammer, cut-off kl. 08:00 og full oversikt. Lunchportalen gir bedrifter kontroll – uten støy.",
      inLanguage: "nb-NO",
    }),
  ];

  return (
    <>
      {/* ✅ JSON-LD */}
      <script
        id="jsonld-home"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }}
      />

      <PageShell>
        {/* HERO (premium crossfade) — FULL BLEED (kant-i-kant) */}
        <section className="lp-hero lp-hero-rotator lp-fullbleed" aria-label="Firmalunsj">
          <div className="lp-hero-media" aria-hidden="true">
            {HERO_IMAGES.map((src, i) => (
              <div className={`lp-hero-frame lp-hero-frame-${i + 1}`} key={src}>
                <Image src={src} alt="" fill priority={i === 0} className="lp-hero-img" sizes="100vw" />
              </div>
            ))}
            <div className="lp-hero-overlay" />
          </div>

          {/* ✅ Hold content inside container while image goes edge-to-edge */}
          <div className="lp-container">
            <Hero />
          </div>
        </section>

        {/* ✅ Computed divider (safe on client) */}
        <div className="lp-container" style={{ marginTop: 14 }}>
          <ComputedDivider
            cssVar="--lp-divider-rgb"
            alpha={0.14}
            className="rounded-full"
            fallback="rgba(255,255,255,0.10)"
          />
        </div>

        {/* HVORFOR */}
        <section className="lp-section" aria-label="Hvorfor">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2 className="lp-h2">Betaler dere for lunsj som ikke blir spist?</h2>
              <p className="lp-sub lp-measure">
                Tradisjonelle løsninger gir ofte matsvinn, merarbeid og uforutsigbarhet. Lunchportalen er laget for
                bedriftsmarkedet: faste rammer, tydelig cut-off og én sannhetskilde.
              </p>
            </div>

            <div className="lp-cards3">
              <div className="lp-card soft lp-card-pad">
                <h3 className="lp-h3">Mindre matsvinn</h3>
                <p className="lp-p">Avbestilling før kl. 08:00 gir mer presis produksjon og mindre svinn.</p>
              </div>

              <div className="lp-card soft lp-card-pad">
                <h3 className="lp-h3">Mindre administrasjon</h3>
                <p className="lp-p">Ansatte håndterer dag-til-dag selv. Admin slipper å være support.</p>
              </div>

              <div className="lp-card soft lp-card-pad">
                <h3 className="lp-h3">Mer forutsigbarhet</h3>
                <p className="lp-p">Avtale på firmanivå uten unntak gir ro og kontroll.</p>
              </div>
            </div>

            <div className="lp-cta-row">
              <Link className="lp-btn lp-btn-primary lp-neon" href="/registrering">
                Registrer firma
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/hvordan">
                Se hvordan det fungerer
              </Link>
            </div>
          </div>
        </section>

        {/* ✅ Neon divider */}
        <div className="lp-container" style={{ marginTop: 6, marginBottom: 6 }}>
          <ComputedDivider cssVar="--lp-neon-rgb" alpha={0.2} fallback="rgba(255,0,127,0.18)" />
        </div>

        {/* HVORDAN (zig-zag) */}
        <section className="lp-section alt" aria-label="Slik fungerer det">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2 className="lp-h2">Slik fungerer det</h2>
              <p className="lp-sub lp-measure">
                Struktur som treffer: <strong>Hva → Hvorfor → Hvordan</strong>. Admin setter rammene, ansatte bestiller
                selv – og kan avbestille før kl. 08:00.
              </p>
            </div>

            <div className="lp-zig">
              <div className="lp-zig-row">
                <div className="lp-zig-text">
                  <div className="lp-zig-step">
                    <span className="lp-neon-ring">1</span>
                    <div>
                      <h3 className="lp-h3">Registrer firma</h3>
                      <p className="lp-p">Start med en ryddig onboarding. Minimum 20 ansatte – laget for stabil drift.</p>
                      <Link className="lp-btn lp-btn-ghost" href="/registrering">
                        Gå til registrering
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="lp-zig-media">
                  <div className="lp-media-card">
                    <Image
                      src="/matbilder/MelhusCatering-Lunsj-1017985.jpg"
                      alt="Firmalunsj til ansatte – levert til kontor"
                      width={1200}
                      height={900}
                      className="lp-section-img"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                </div>
              </div>

              <div className="lp-zig-row is-reverse">
                <div className="lp-zig-text">
                  <div className="lp-zig-step">
                    <span className="lp-neon-ring">2</span>
                    <div>
                      <h3 className="lp-h3">Admin setter avtale og nivå</h3>
                      <p className="lp-p">
                        Velg Basis/Luxus, dager og lokasjon. Avtalen låses på firmanivå – uten manuelle unntak.
                      </p>
                      <Link className="lp-btn lp-btn-ghost" href="/hvordan#pris">
                        Se prisnivå
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="lp-zig-media">
                  <div className="lp-media-card">
                    <Image
                      src="/matbilder/MelhusCatering-Lunsj-1018001.jpg"
                      alt="Variert firmalunsj – lunchordning for firma"
                      width={1200}
                      height={900}
                      className="lp-section-img"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                </div>
              </div>

              <div className="lp-zig-row">
                <div className="lp-zig-text">
                  <div className="lp-zig-step">
                    <span className="lp-neon-ring">3</span>
                    <div>
                      <h3 className="lp-h3">Ansatte bestiller selv</h3>
                      <p className="lp-p">
                        Bestilling/avbestilling i portalen. Cut-off før kl. 08:00 gir presis drift og mindre svinn.
                      </p>
                      <Link className="lp-btn lp-btn-primary lp-neon" href="/hvordan">
                        Les hele modellen
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="lp-zig-media">
                  <div className="lp-media-card">
                    <Image
                      src="/matbilder/MelhusCatering-Lunsj-1018019.jpg"
                      alt="Bestillingssystem for lunsj – digital lunsjplattform"
                      width={1200}
                      height={900}
                      className="lp-section-img"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-cta-row">
              <Link className="lp-btn lp-btn-primary lp-neon" href="/registrering">
                Registrer firma
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/hvordan">
                Se hvordan det fungerer
              </Link>
            </div>
          </div>
        </section>

        {/* PRISNIVÅ */}
        <section className="lp-section" aria-label="Prisnivå">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2 className="lp-h2">To nivå – tydelig avtale</h2>
              <p className="lp-sub lp-measure">
                Avtalen settes av firma/admin. Mange velger en kombinasjon (f.eks. 4 dager Basis og 1 dag Luxus).
              </p>
            </div>

            <div className="lp-pricing">
              <div className="lp-card pricing">
                <div className="lp-pill">Basis</div>
                <h3 className="lp-h3">Stabil hverdag</h3>
                <p className="lp-p">Salatbar, påsmurt og varmmat.</p>
                <div className="lp-price">
                  <span className="lp-price-n">90</span>
                  <span className="lp-price-s">kr / kuvert</span>
                </div>
                <ul className="lp-list">
                  <li>Selvbetjening for ansatte</li>
                  <li>Avbestilling før kl. 08:00</li>
                  <li>Forutsigbar firmalunsj</li>
                </ul>
                <Link className="lp-btn lp-btn-primary lp-btn-block lp-neon" href="/registrering">
                  Velg Basis
                </Link>
              </div>

              <div className="lp-card pricing featured lp-price-visual">
                <div className="lp-price-bg" aria-hidden="true">
                  <Image
                    src="/matbilder/MelhusCatering-Lunsj-1018038.jpg"
                    alt=""
                    fill
                    className="lp-price-bg-img"
                    sizes="(max-width: 980px) 100vw, 50vw"
                  />
                </div>

                <div className="lp-pill hot">Luxus</div>
                <h3 className="lp-h3">Mer variasjon</h3>
                <p className="lp-p">Salatbar, påsmurt, varmmat + sushi, pokébowl og thaimat.</p>
                <div className="lp-price">
                  <span className="lp-price-n">130</span>
                  <span className="lp-price-s">kr / kuvert</span>
                </div>
                <ul className="lp-list">
                  <li>Høy opplevd verdi</li>
                  <li>Kontrollert flyt</li>
                  <li>Avbestilling før kl. 08:00</li>
                </ul>
                <Link className="lp-btn lp-btn-primary lp-btn-block lp-neon" href="/registrering">
                  Velg Luxus
                </Link>
              </div>
            </div>

            <div className="lp-cta-row">
              <Link className="lp-btn lp-btn-ghost" href="/lunsjordning">
                Lunsjordning for bedrift
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/alternativ-til-kantine">
                Alternativ til kantine
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/system-for-lunsjbestilling">
                System for lunsjbestilling
              </Link>
            </div>
          </div>
        </section>

        {/* LOKALT */}
        <section className="lp-section alt" aria-label="Lokalt">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2 className="lp-h2">Lokalt og nasjonalt – laget for bedriftsmarkedet</h2>
              <p className="lp-sub lp-measure">
                Relevant for søk som <strong>lunsj levering Oslo</strong>, <strong>lunsjordning Trondheim</strong> og{" "}
                <strong>lunch levering Bergen</strong>. Modellen er den samme: kontroll, tempo og forutsigbar drift.
              </p>
            </div>

            <div className="lp-local-grid">
              <div className="lp-local-card">
                <Image
                  src="/matbilder/MelhusCatering-Lunsj-1018047.jpg"
                  alt="Lunsj levering Oslo – lunsj til kontor"
                  width={1200}
                  height={900}
                  className="lp-section-img"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                <div className="lp-local-meta">
                  <div className="lp-local-h">Oslo</div>
                  <div className="lp-local-p">For bedrifter som vil ha lunsjlevering med kontroll.</div>
                </div>
              </div>

              <div className="lp-local-card">
                <Image
                  src="/matbilder/MelhusCatering-Lunsj-1018059.jpg"
                  alt="Lunsjordning Trondheim – lunsj til ansatte"
                  width={1200}
                  height={900}
                  className="lp-section-img"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                <div className="lp-local-meta">
                  <div className="lp-local-h">Trondheim</div>
                  <div className="lp-local-p">Tydelig bestillingssystem og rolig drift.</div>
                </div>
              </div>

              <div className="lp-local-card">
                <Image
                  src="/matbilder/MelhusCatering-Lunsj-1018064.jpg"
                  alt="Lunch levering Bergen – lunchordning for firma"
                  width={1200}
                  height={900}
                  className="lp-section-img"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                <div className="lp-local-meta">
                  <div className="lp-local-h">Bergen</div>
                  <div className="lp-local-p">En modell som skalerer – uten å miste kontroll.</div>
                </div>
              </div>
            </div>

            <div className="lp-cta-row">
              <Link className="lp-btn lp-btn-primary lp-neon" href="/registrering">
                Registrer firma
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/hvordan">
                Se hvordan det fungerer
              </Link>
            </div>
          </div>
        </section>

        {/* RELATERTE SIDER */}
        <RelatedLinks currentPath="/" tags={["core", "seo", "local", "system", "alt_kantine"]} />

        {/* FINAL CTA */}
        <section className="lp-section" style={{ paddingTop: 38 }} aria-label="Kom i gang">
          <div className="lp-container">
            <div className="lp-final-cta">
              <h2 className="lp-h2" style={{ marginBottom: 8 }}>
                Klar for firmalunsj med kontroll?
              </h2>
              <p className="lp-sub lp-measure" style={{ marginBottom: 16 }}>
                Registrer firma og få en strukturert lunsjløsning med tydelig cut-off, mindre matsvinn og full oversikt.
              </p>
              <div className="lp-actions">
                <Link className="lp-btn lp-btn-primary lp-neon" href="/registrering">
                  Registrer firma
                </Link>
                <Link className="lp-btn lp-btn-ghost" href="/hvordan">
                  Les hvordan det fungerer
                </Link>
              </div>
            </div>
          </div>
        </section>
      </PageShell>
    </>
  );
}

