"use client";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import type { ProviderMenuCatalogSnapshot } from "@/lib/provider-menu/lunchCategoryCatalog";
import {
  catalogVariantsForTier,
  catalogSupportsPersistentEdit,
  type MenuCatalogVariant,
} from "@/lib/provider-menu/providerMenuCatalogReadModel";
import { CATALOG_PERSISTENCE_GAP } from "@/lib/provider-menu/providerMenuCatalogReadModel";
import ProviderMenuCatalogEditor from "@/components/providers/ProviderMenuCatalogEditor";

type Props = {
  tier: PlanTier;
  catalog: ProviderMenuCatalogSnapshot;
  onSelectVariant: (variant: MenuCatalogVariant) => void;
  onCatalogSaved: (catalog: ProviderMenuCatalogSnapshot) => void;
};

export default function ProviderMenuCatalogView({
  tier,
  catalog,
  onSelectVariant,
  onCatalogSaved,
}: Props) {
  const variants = catalogVariantsForTier(catalog, tier);
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
        <p className="ds-body">Faste alternativer for din leverandør — ikke ukesinnhold.</p>
        {catalogSupportsPersistentEdit() ? (
          <p className="ds-provider-menu-catalog__gap" role="status">
            {CATALOG_PERSISTENCE_GAP}
          </p>
        ) : null}
      </header>

      {catalogSupportsPersistentEdit() ? (
        <ProviderMenuCatalogEditor tier={tier} catalog={catalog} onCatalogSaved={onCatalogSaved} />
      ) : null}

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
                      <span className="ds-provider-menu-catalog__item-meta">Din katalog</span>
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
