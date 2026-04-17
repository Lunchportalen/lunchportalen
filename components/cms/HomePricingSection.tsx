import Image from "next/image";
import Link from "next/link";

import {
  marketingContainerClassString,
  marketingSectionClassString,
  mergeFullDesign,
  mergedBodyClassString,
  mergedHeadingClassString,
  pricingPlanSurfaceClassString,
  type ParsedDesignSettings,
} from "@/lib/cms/design/designContract";
import { getDesignSettings } from "@/lib/cms/design/getDesignSettings";
import { homePricingCopyFromCms } from "@/lib/cms/marketingMeals";

export type HomePricingSectionProps = {
  title?: string;
  intro?: string;
  /** When omitted, loads published global design once (same as public render). */
  designSettings?: ParsedDesignSettings | null;
};

/**
 * Server-only: Basis/Luxus pricing cards using product plans + menus (same source as static homepage).
 */
export async function HomePricingSection({ title, intro, designSettings }: HomePricingSectionProps) {
  const ds = designSettings ?? (await getDesignSettings());
  const merged = mergeFullDesign(null, ds, "pricing");
  const pricingCopy = await homePricingCopyFromCms();
  const h2 = title?.trim() || "To nivå – tydelig avtale";
  const lead =
    intro?.trim() ||
    "Avtalen settes av firma/admin. Mange velger en kombinasjon (f.eks. 4 dager Basis og 1 dag Luxus).";

  return (
    <section className={marketingSectionClassString(merged)} aria-label="Prisnivå">
      <div className={marketingContainerClassString(merged)}>
        <div className="lp-section-head">
          <h2 className={mergedHeadingClassString(merged, "h2")}>{h2}</h2>
          <p className={mergedBodyClassString(merged, { measure: true })}>{lead}</p>
        </div>

        <div className="lp-pricing">
          <div className={pricingPlanSurfaceClassString(false, undefined, ds)}>
            <div className="lp-pill">Basis</div>
            <h3 className={mergedHeadingClassString(merged, "h3")}>Stabil hverdag</h3>
            <p className={merged.typography.body === "compact" ? "lp-p-sm" : "lp-p"}>{pricingCopy.basisLine}</p>
            <div className="lp-price">
              <span className="lp-price-n">{pricingCopy.basisPrice}</span>
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

          <div className={`${pricingPlanSurfaceClassString(true, undefined, ds)} lp-price-visual`}>
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
            <h3 className={mergedHeadingClassString(merged, "h3")}>Mer variasjon</h3>
            <p className={merged.typography.body === "compact" ? "lp-p-sm" : "lp-p"}>{pricingCopy.luxusLine}</p>
            <div className="lp-price">
              <span className="lp-price-n">{pricingCopy.luxusPrice}</span>
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
  );
}
