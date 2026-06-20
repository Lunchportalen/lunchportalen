"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import {
  CATALOG_WEEK_PUBLISH_HINT,
  EDITABLE_LUNCH_CATEGORY_KEYS,
  LUNCH_CATEGORY_ALLERGENS,
  categoryFromLunchCategoryKey,
  categoryLabelFromCatalog,
  type ProviderMenuCatalogSnapshot,
} from "@/lib/provider-menu/lunchCategoryCatalog";

type CatalogItemDraft = {
  key?: string;
  title: string;
  allergens: string[];
  isVegetarian: boolean;
  orderLocked?: boolean;
};

function OrderLockBadge() {
  return (
    <span className="ds-order-lock-badge" title="Har bestilling">
      <span className="ds-order-lock-badge__icon" aria-hidden="true">🔒</span>
      <span className="ds-order-lock-badge__text">Har bestilling</span>
    </span>
  );
}

type Props = {
  tier: PlanTier;
  catalog: ProviderMenuCatalogSnapshot;
  onCatalogSaved: (catalog: ProviderMenuCatalogSnapshot) => void;
};

function itemsForCategory(catalog: ProviderMenuCatalogSnapshot, categoryKey: string): CatalogItemDraft[] {
  const row = catalog.rows.find((r) => String(r.key ?? "").toLowerCase() === categoryKey);
  if (!row || !Array.isArray(row.items)) return [];
  return row.items.map((item) => ({
    key: item.key,
    title: item.title,
    allergens: Array.isArray(item.allergens) ? [...item.allergens] : [],
    isVegetarian: item.isVegetarian === true,
    orderLocked: item.orderLocked === true,
  }));
}

export default function ProviderMenuCatalogEditor({ tier, catalog, onCatalogSaved }: Props) {
  const editableKeys = useMemo(
    () =>
      EDITABLE_LUNCH_CATEGORY_KEYS.filter((key) => {
        const cat = categoryFromLunchCategoryKey(key);
        if (!cat) return false;
        const row = catalog.rows.find((r) => String(r.key ?? "").toLowerCase() === key);
        const tiers = Array.isArray(row?.allowedPlanTiers) ? row.allowedPlanTiers : [];
        return tiers.some((t) => String(t).toUpperCase() === tier);
      }),
    [catalog, tier],
  );

  const [categoryKey, setCategoryKey] = useState<string>(editableKeys[0] ?? "paasmurt");
  const [items, setItems] = useState<CatalogItemDraft[]>(() => itemsForCategory(catalog, categoryKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setItems(itemsForCategory(catalog, categoryKey));
    setError(null);
    setMessage(null);
  }, [catalog, categoryKey]);

  const categoryLabel = useMemo(() => {
    const cat = categoryFromLunchCategoryKey(categoryKey);
    return cat ? categoryLabelFromCatalog(catalog, cat) : categoryKey;
  }, [catalog, categoryKey]);

  const toggleAllergen = useCallback((index: number, allergen: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const set = new Set(item.allergens);
        if (set.has(allergen)) set.delete(allergen);
        else set.add(allergen);
        return { ...item, allergens: [...set] };
      }),
    );
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/provider/menu-catalog", {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          categoryKey,
          items: items.map((item) => ({
            ...(item.key ? { key: item.key } : {}),
            title: item.title,
            allergens: item.allergens,
            isVegetarian: item.isVegetarian,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Kunne ikke lagre katalog.");
        return;
      }
      if (json.data?.catalog) {
        onCatalogSaved(json.data.catalog);
      }
      setMessage("Katalog lagret.");
    } catch {
      setError("Kunne ikke lagre katalog.");
    } finally {
      setSaving(false);
    }
  }

  if (editableKeys.length === 0) {
    return (
      <p className="ds-body" role="status">
        Ingen redigerbare kategorier for {tier}.
      </p>
    );
  }

  return (
    <section className="ds-provider-menu-catalog-editor" aria-label="Rediger menykatalog">
      <header className="ds-provider-menu-catalog-editor__head">
        <h2 className="ds-h4">Din menykatalog</h2>
        <p className="ds-body">
          Dette endrer kun din leverandørs faste valg — ikke andre cateringfirmaer.
        </p>
        <p className="ds-provider-menu-catalog__gap" role="status">
          {CATALOG_WEEK_PUBLISH_HINT}
        </p>
      </header>

      <div className="ds-provider-menu-catalog-editor__toolbar">
        <label className="ds-provider-menu-catalog-editor__label" htmlFor="catalog-category">
          Kategori
        </label>
        <select
          id="catalog-category"
          className="ds-provider-menu-catalog-editor__select"
          value={categoryKey}
          onChange={(e) => setCategoryKey(e.target.value)}
        >
          {editableKeys.map((key) => {
            const cat = categoryFromLunchCategoryKey(key);
            const label = cat ? categoryLabelFromCatalog(catalog, cat) : key;
            return (
              <option key={key} value={key}>
                {label}
              </option>
            );
          })}
        </select>
      </div>

      <h3 className="ds-provider-menu-catalog-editor__category-title">{categoryLabel}</h3>

      <ul className="ds-provider-menu-catalog-editor__list">
        {items.map((item, index) => (
          <li
            key={item.key ?? `new-${index}`}
            className={`ds-provider-menu-catalog-editor__row${item.orderLocked ? " is-order-locked" : ""}`}
          >
            {item.orderLocked ? <OrderLockBadge /> : null}
            <label className="ds-provider-menu-catalog-editor__label">
              Tittel
              <input
                type="text"
                className="ds-provider-menu-catalog-editor__input"
                value={item.title}
                disabled={item.orderLocked}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((row, i) => (i === index ? { ...row, title: e.target.value } : row)),
                  )
                }
                maxLength={120}
              />
            </label>
            {item.key ? (
              <span className="ds-provider-menu-catalog-editor__slug" aria-label="Fast slug">
                {item.key}
              </span>
            ) : (
              <span className="ds-provider-menu-catalog-editor__slug">Ny — slug genereres ved lagring</span>
            )}
            <label className="ds-provider-menu-catalog-editor__checkbox">
              <input
                type="checkbox"
                checked={item.isVegetarian}
                disabled={item.orderLocked}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((row, i) => (i === index ? { ...row, isVegetarian: e.target.checked } : row)),
                  )
                }
              />
              Vegetar
            </label>
            <fieldset className="ds-provider-menu-catalog-editor__allergens" disabled={item.orderLocked}>
              <legend className="ds-provider-menu-catalog-editor__legend">Allergener</legend>
              {LUNCH_CATEGORY_ALLERGENS.map((a) => (
                <label key={a} className="ds-provider-menu-catalog-editor__checkbox">
                  <input
                    type="checkbox"
                    checked={item.allergens.includes(a)}
                    onChange={() => toggleAllergen(index, a)}
                  />
                  {a}
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              className="ds-provider-menu-catalog-editor__remove"
              disabled={item.orderLocked}
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
            >
              Fjern
            </button>
          </li>
        ))}
      </ul>

      <div className="ds-provider-menu-catalog-editor__actions">
        <button
          type="button"
          className="ds-provider-menu-catalog-editor__add"
          onClick={() =>
            setItems((prev) => [...prev, { title: "", allergens: [], isVegetarian: false }])
          }
        >
          Legg til valg
        </button>
        <button
          type="button"
          className="ds-provider-menu-catalog-editor__save"
          disabled={saving || items.length === 0}
          onClick={() => void save()}
        >
          {saving ? "Lagrer…" : "Lagre katalog"}
        </button>
      </div>

      {error ? (
        <p className="ds-provider-menu-catalog-editor__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="ds-provider-menu-catalog-editor__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
