"use client";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import {
  CATALOG_PERSISTENCE_GAP,
  catalogVariantsForTier,
  catalogSupportsPersistentEdit,
  type MenuCatalogVariant,
} from "@/lib/provider-menu/providerMenuCatalogReadModel";

type Props = {
  tier: PlanTier;
  onSelectVariant: (variant: MenuCatalogVariant) => void;
};

export default function ProviderMenuCatalogView({ tier, onSelectVariant }: Props) {
  const variants = catalogVariantsForTier(tier);
  const byCategory = new Map<string, MenuCatalogVariant[]>();
  for (const v of variants) {
    const list = byCategory.get(v.categoryLabel) ?? [];
    list.push(v);
    byCategory.set(v.categoryLabel, list);
  }

  return (
    <section className="ds-provider-menu-catalog" aria-label="Menykatalog">
      <header className="ds-provider-menu-catalog__head">
        <h2 className="ds-h4">Menykatalog</h2>
        <p className="ds-body">Faste alternativer som masterdata — ikke ukesinnhold.</p>
        {!catalogSupportsPersistentEdit() ? (
          <p className="ds-provider-menu-catalog__gap" role="status">
            {CATALOG_PERSISTENCE_GAP}
          </p>
        ) : null}
      </header>

      <div className="ds-provider-menu-catalog__groups">
        {[...byCategory.entries()].map(([label, items]) => (
          <section key={label} className="ds-provider-menu-catalog__group">
            <h3 className="ds-provider-menu-catalog__group-title">{label}</h3>
            <ul className="ds-provider-menu-catalog__list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="ds-provider-menu-catalog__item"
                    onClick={() => onSelectVariant(item)}
                  >
                    <span className="ds-provider-menu-catalog__item-label">{item.label}</span>
                    {item.source === "SANITY" ? (
                      <span className="ds-provider-menu-catalog__item-meta">Sanity/bank</span>
                    ) : (
                      <span className="ds-provider-menu-catalog__item-meta">Fast valg</span>
                    )}
                    {item.allergens.length > 0 ? (
                      <span className="ds-provider-menu-catalog__item-allergens">
                        {item.allergens.join(", ")}
                      </span>
                    ) : null}
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="ds-provider-menu-catalog__thumb" />
                    ) : (
                      <span className="ds-provider-menu-catalog__media-slot" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
