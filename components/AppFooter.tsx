// components/AppFooter.tsx
import Image from "next/image";
import Link from "next/link";

type ContainerMode = "container" | "full";

export default function AppFooter({ containerMode = "container" }: { containerMode?: ContainerMode }) {
  // ✅ FULL: footer går 100% bredde, men content har kontrollert max-bredde
  const innerMax = containerMode === "full" ? "lp-footer-shell" : "lp-footer-shell lp-max-1400";

  return (
    <footer className="lp-footer lp-footer--full" aria-label="Footer">
      <div className={innerMax}>
        <div className="lp-footer-grid">
          {/* BRAND */}
          <div className="lp-footer-col lp-footer-brandcol">
            <Link href="/" className="lp-footer-brand" aria-label="Gå til forsiden">
              <Image
                src="/brand/LP-logo-uten-bakgrunn.png"
                alt="Lunchportalen"
                width={900}
                height={320}
                className="lp-footer-logo"
                priority={false}
              />
            </Link>

            <p className="lp-footer-text">
              Firmalunsj uten støy. Faste rammer, cut-off kl. 08:00 og full kontroll for admin.
            </p>

            <div className="lp-footer-cta">
              <Link className="lp-btn lp-btn-primary lp-neon" href="/registrering">
                Registrer firma
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/hvordan">
                Se hvordan det fungerer
              </Link>
            </div>

            <div className="lp-footer-mini">
              <span className="lp-chip lp-chip-neutral">Én sannhetskilde</span>
              <span className="lp-chip lp-chip-neutral">08:00 cut-off</span>
              <span className="lp-chip lp-chip-neutral">Admin-kontroll</span>
            </div>
          </div>

          {/* LØSNING */}
          <div className="lp-footer-col">
            <div className="lp-footer-head">Løsning</div>
            <div className="lp-footer-links">
              <Link className="lp-footer-link" href="/hvordan">
                Hvordan det fungerer
              </Link>
              <Link className="lp-footer-link" href="/lunsjordning">
                Lunsjordning
              </Link>
              <Link className="lp-footer-link" href="/alternativ-til-kantine">
                Alternativ til kantine
              </Link>
              <Link className="lp-footer-link" href="/system-for-lunsjbestilling">
                System for lunsjbestilling
              </Link>
            </div>
          </div>

          {/* LOKALT */}
          <div className="lp-footer-col">
            <div className="lp-footer-head">Lokalt</div>
            <div className="lp-footer-links">
              <Link className="lp-footer-link" href="/lunsj-levering-oslo">
                Lunsj levering Oslo
              </Link>
              <Link className="lp-footer-link" href="/lunsjordning-trondheim">
                Lunsjordning Trondheim
              </Link>
              <Link className="lp-footer-link" href="/lunch-levering-bergen">
                Lunch levering Bergen
              </Link>
            </div>
          </div>

          {/* KONTAKT */}
          <div className="lp-footer-col">
            <div className="lp-footer-head">Kontakt</div>
            <div className="lp-footer-links">
              <Link className="lp-footer-link" href="/kontakt">
                Kontakt oss
              </Link>
              <Link className="lp-footer-link" href="/personvern">
                Personvern
              </Link>
              <Link className="lp-footer-link" href="/vilkar">
                Vilkår
              </Link>
            </div>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Lunchportalen</span>
          <span className="lp-footer-dot" aria-hidden="true" />
          <span className="lp-text-muted">Bedriftslunsj med kontroll</span>
        </div>
      </div>
    </footer>
  );
}
