// components/AppFooter.tsx
import Image from "next/image";
import Link from "next/link";

import { getContentBySlug } from "@/lib/cms/public/getContentBySlug";
import { parseBody } from "@/lib/cms/public/parseBody";
import { normalizeBlockForRender } from "@/lib/cms/public/normalizeBlockForRender";
import { renderBlock } from "@/lib/public/blocks/renderBlock";
import { getFooterVariantClass, type FooterVariant } from "@/lib/ui/footerVariants";

type ContainerMode = "container" | "full";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** Shared footer shell. Pass variant for lp-footer-* (glass/soft/gradient/outline/glow); omit for default. Structure: lp-footer lp-footer--full from globals. */
export default async function AppFooter({
  containerMode = "container",
  variant,
}: {
  containerMode?: ContainerMode;
  /** Visual variant (lib/ui/footerVariants); omit for default footer look */
  variant?: FooterVariant;
}) {
  // ✅ FULL: footer går 100% bredde, men content har kontrollert max-bredde
  const innerMax = containerMode === "full" ? "lp-footer-shell" : "lp-footer-shell lp-max-1400";
  const footerClass = cn("lp-footer lp-footer--full", getFooterVariantClass(variant));

  // Optional global footer content from CMS (content_pages slug "footer", prod variant, locale nb).
  const footerContent = await getContentBySlug("footer").catch(() => null);
  const footerBlocks = footerContent ? parseBody(footerContent.body) : [];
  const safeFooterBlocks = Array.isArray(footerBlocks) ? footerBlocks : [];

  return (
    <footer className={footerClass} aria-label="Footer">
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

        {/* Global footer content from CMS (optional, appended below fixed columns). */}
        {safeFooterBlocks.length > 0 && (
          <section className="mt-6 border-t border-[rgb(var(--lp-border))] pt-4">
            <div className="flex flex-col gap-4">
              {safeFooterBlocks.map((block, i) => {
                const node = normalizeBlockForRender(block ?? null, i);
                return (
                  <div key={node.id}>
                    {renderBlock(node, "prod", "nb")}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Lunchportalen</span>
          <span className="lp-footer-dot" aria-hidden="true" />
          <span className="lp-text-muted">Bedriftslunsj med kontroll</span>
        </div>
      </div>
    </footer>
  );
}
