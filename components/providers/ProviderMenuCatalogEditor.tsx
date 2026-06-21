"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import {
  CATALOG_WEEK_PUBLISH_HINT,
  EDITABLE_LUNCH_CATEGORY_KEYS,
  LUNCH_CATEGORY_ALLERGENS,
  categoryFromLunchCategoryKey,
  categoryLabelFromCatalog,
  type EditableLunchCategoryKey,
  type ProviderMenuCatalogSnapshot,
} from "@/lib/provider-menu/lunchCategoryCatalog";

type CatalogItemDraft = {
  key?: string;
  title: string;
  allergens: string[];
  isVegetarian: boolean;
  orderLocked?: boolean;
};

const PREMIUM_CATEGORY_KEYS = new Set<EditableLunchCategoryKey>(["sushi", "pokebowl", "thaimat"]);

function tierBadgeForCategoryKey(key: EditableLunchCategoryKey): string {
  return PREMIUM_CATEGORY_KEYS.has(key) ? "Luxus + Enterprise" : "Alle nivåer";
}

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

function categoryLabel(catalog: ProviderMenuCatalogSnapshot, categoryKey: EditableLunchCategoryKey): string {
  const cat = categoryFromLunchCategoryKey(categoryKey);
  return cat ? categoryLabelFromCatalog(catalog, cat) : categoryKey;
}

type Props = {
  tier: PlanTier;
  catalog: ProviderMenuCatalogSnapshot;
  onCatalogSaved: (catalog: ProviderMenuCatalogSnapshot) => void;
  initialOpenCategoryKey?: string;
  panelMode?: boolean;
};

type CategoryAccordionProps = {
  categoryKey: EditableLunchCategoryKey;
  catalog: ProviderMenuCatalogSnapshot;
  isOpen: boolean;
  items: CatalogItemDraft[];
  saving: boolean;
  onToggle: () => void;
  onItemsChange: (items: CatalogItemDraft[]) => void;
  onCancel: () => void;
  onSave: () => void;
};

function CatalogItemRow({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: CatalogItemDraft;
  index: number;
  onChange: (index: number, next: CatalogItemDraft) => void;
  onRemove: (index: number) => void;
}) {
  const toggleAllergen = (allergen: string) => {
    const set = new Set(item.allergens);
    if (set.has(allergen)) set.delete(allergen);
    else set.add(allergen);
    onChange(index, { ...item, allergens: [...set] });
  };

  return (
    <li className={`lp-editor-catalog-acc__item${item.orderLocked ? " is-order-locked" : ""}`}>
      <span className="lp-editor-catalog-acc__drag" aria-hidden="true" title="Rekkefølge styres av katalog">
        ⠿
      </span>
      <input
        type="text"
        className="lp-editor-catalog-acc__input"
        value={item.title}
        disabled={item.orderLocked}
        placeholder="Navn på valg"
        onChange={(e) => onChange(index, { ...item, title: e.target.value })}
        maxLength={120}
      />
      <div className="lp-editor-catalog-acc__tags">
        {item.orderLocked ? (
          <span className="lp-editor-catalog-acc__tag is-locked">
            <span aria-hidden="true">🔒</span> Låst
          </span>
        ) : null}
        {item.isVegetarian ? <span className="lp-editor-catalog-acc__tag is-veg">Vegetar</span> : null}
        {item.allergens.slice(0, 3).map((a) => (
          <span key={a} className="lp-editor-catalog-acc__tag is-allergen">
            {a}
          </span>
        ))}
        {item.allergens.length > 3 ? (
          <span className="lp-editor-catalog-acc__tag is-allergen">+{item.allergens.length - 3}</span>
        ) : null}
      </div>
      {!item.orderLocked ? (
        <div className="lp-editor-catalog-acc__item-meta">
          <label className="lp-editor-catalog-acc__veg-toggle">
            <input
              type="checkbox"
              checked={item.isVegetarian}
              onChange={(e) => onChange(index, { ...item, isVegetarian: e.target.checked })}
            />
            Vegetar
          </label>
          <div className="lp-editor-catalog-acc__allergen-chips" role="group" aria-label="Allergener">
            {LUNCH_CATEGORY_ALLERGENS.map((a) => (
              <button
                key={a}
                type="button"
                className={`lp-editor-catalog-acc__chip${item.allergens.includes(a) ? " is-on" : ""}`}
                onClick={() => toggleAllergen(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="lp-editor-catalog-acc__remove"
        disabled={item.orderLocked}
        aria-label={`Fjern ${item.title || "valg"}`}
        onClick={() => onRemove(index)}
      >
        ×
      </button>
    </li>
  );
}

function CategoryAccordion({
  categoryKey,
  catalog,
  isOpen,
  items,
  saving,
  onToggle,
  onItemsChange,
  onCancel,
  onSave,
}: CategoryAccordionProps) {
  const label = categoryLabel(catalog, categoryKey);
  const tierBadge = tierBadgeForCategoryKey(categoryKey);
  const lockedCount = items.filter((i) => i.orderLocked).length;

  return (
    <article className={`lp-editor-catalog-acc${isOpen ? " is-open" : ""}`}>
      <header className="lp-editor-catalog-acc__head">
        <button type="button" className="lp-editor-catalog-acc__head-main" onClick={onToggle}>
          <span className="lp-editor-catalog-acc__name">{label}</span>
          <span className="lp-editor-catalog-acc__tier">{tierBadge}</span>
          <span className="lp-editor-catalog-acc__count">
            {items.length} {items.length === 1 ? "valg" : "valg"}
          </span>
          {lockedCount > 0 ? (
            <span className="lp-editor-catalog-acc__locked">{lockedCount} låst</span>
          ) : null}
        </button>
        <button type="button" className="lp-editor-catalog-acc__edit" onClick={onToggle}>
          {isOpen ? "Lukk" : "Rediger"}
        </button>
        <span className={`lp-editor-catalog-acc__chevron${isOpen ? " is-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </header>

      {isOpen ? (
        <div className="lp-editor-catalog-acc__body">
          <ul className="lp-editor-catalog-acc__list">
            {items.map((item, index) => (
              <CatalogItemRow
                key={item.key ?? `new-${index}`}
                item={item}
                index={index}
                onChange={(i, next) =>
                  onItemsChange(items.map((row, ri) => (ri === i ? next : row)))
                }
                onRemove={(i) => onItemsChange(items.filter((_, ri) => ri !== i))}
              />
            ))}
          </ul>
          <button
            type="button"
            className="lp-editor-catalog-acc__add"
            onClick={() => onItemsChange([...items, { title: "", allergens: [], isVegetarian: false }])}
          >
            + Legg til valg
          </button>
          <p className="lp-editor-catalog-acc__note" role="note">
            <span aria-hidden="true">ℹ</span>
            {CATALOG_WEEK_PUBLISH_HINT}
          </p>
          <footer className="lp-editor-catalog-acc__footer">
            <button type="button" className="ds-btn ds-btn--ghost" disabled={saving} onClick={onCancel}>
              Avbryt
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              disabled={saving || items.length === 0}
              onClick={onSave}
            >
              {saving ? "Lagrer…" : "Lagre katalog"}
            </button>
          </footer>
        </div>
      ) : null}
    </article>
  );
}

function CatalogAccordionEditor({
  catalog,
  onCatalogSaved,
  initialOpenCategoryKey,
}: {
  catalog: ProviderMenuCatalogSnapshot;
  onCatalogSaved: (catalog: ProviderMenuCatalogSnapshot) => void;
  initialOpenCategoryKey?: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(initialOpenCategoryKey ?? null);
  const [drafts, setDrafts] = useState<Record<string, CatalogItemDraft[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialOpenCategoryKey) {
      setOpenKey(initialOpenCategoryKey);
      setDrafts((prev) => ({
        ...prev,
        [initialOpenCategoryKey]: itemsForCategory(catalog, initialOpenCategoryKey),
      }));
    }
  }, [initialOpenCategoryKey, catalog]);

  const openDraft = openKey ? (drafts[openKey] ?? itemsForCategory(catalog, openKey)) : [];

  const toggleCategory = (key: EditableLunchCategoryKey) => {
    setError(null);
    setMessage(null);
    if (openKey === key) {
      setOpenKey(null);
      return;
    }
    setOpenKey(key);
    setDrafts((prev) => ({ ...prev, [key]: itemsForCategory(catalog, key) }));
  };

  const cancelEdit = () => {
    if (!openKey) return;
    setDrafts((prev) => ({ ...prev, [openKey]: itemsForCategory(catalog, openKey) }));
    setOpenKey(null);
    setError(null);
  };

  async function saveOpenCategory() {
    if (!openKey) return;
    const items = drafts[openKey] ?? itemsForCategory(catalog, openKey);
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/provider/menu-catalog", {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          categoryKey: openKey,
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

  return (
    <section className="lp-editor-catalog-editor lp-editor-catalog-editor--accordion" aria-label="Menykatalog">
      <header className="lp-editor-catalog-head">
        <h2 className="lp-editor-catalog-head__title">Menykatalog</h2>
        <p className="lp-editor-catalog-head__lead">
          Valgene du tilbyr under hver kategori. Strukturen ligger fast — innholdet eier du.
        </p>
      </header>

      <div className="lp-editor-catalog-isolate">
        <div className="lp-editor-catalog-isolate__body">
          <b className="lp-editor-catalog-isolate__title">Din egen katalog</b>
          <p className="lp-editor-catalog-isolate__text">
            Endringer påvirker kun din meny. Andre leverandører ser sin egen — ingen deler innhold med deg.
          </p>
        </div>
        <span className="lp-editor-catalog-isolate__pill">Isolert</span>
      </div>

      <div className="lp-editor-catalog-accordion">
        {EDITABLE_LUNCH_CATEGORY_KEYS.map((key) => {
          const items = openKey === key ? openDraft : itemsForCategory(catalog, key);
          return (
            <CategoryAccordion
              key={key}
              categoryKey={key}
              catalog={catalog}
              isOpen={openKey === key}
              items={items}
              saving={saving && openKey === key}
              onToggle={() => toggleCategory(key)}
              onItemsChange={(next) => setDrafts((prev) => ({ ...prev, [key]: next }))}
              onCancel={cancelEdit}
              onSave={() => void saveOpenCategory()}
            />
          );
        })}
      </div>

      {error ? (
        <p className="lp-editor-catalog-editor__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="lp-editor-catalog-editor__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function CatalogLegacyEditor({
  tier,
  catalog,
  onCatalogSaved,
}: {
  tier: PlanTier;
  catalog: ProviderMenuCatalogSnapshot;
  onCatalogSaved: (catalog: ProviderMenuCatalogSnapshot) => void;
}) {
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

  const categoryLabelLegacy = useMemo(() => {
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

  async function saveLegacy() {
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
    <section className="lp-editor-catalog-editor" aria-label="Rediger menykatalog">
      <header className="lp-editor-catalog-editor__head">
        <h2 className="ds-h4">Din menykatalog</h2>
        <p className="ds-body">
          Dette endrer kun din leverandørs faste valg — ikke andre cateringfirmaer.
        </p>
        <p className="lp-editor-catalog__gap" role="status">
          {CATALOG_WEEK_PUBLISH_HINT}
        </p>
      </header>

      <div className="lp-editor-catalog-editor__toolbar">
        <label className="lp-editor-catalog-editor__label" htmlFor="catalog-category">
          Kategori
        </label>
        <select
          id="catalog-category"
          className="lp-editor-catalog-editor__select"
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

      <h3 className="lp-editor-catalog-editor__category-title">{categoryLabelLegacy}</h3>

      <ul className="lp-editor-catalog-editor__list">
        {items.map((item, index) => (
          <li
            key={item.key ?? `new-${index}`}
            className={`lp-editor-catalog-editor__row${item.orderLocked ? " is-order-locked" : ""}`}
          >
            {item.orderLocked ? (
              <span className="lp-editor-order-lock" title="Har bestilling">
                <span className="lp-editor-order-lock__icon" aria-hidden="true">
                  🔒
                </span>
                <span className="lp-editor-order-lock__text">Har bestilling</span>
              </span>
            ) : null}
            <label className="lp-editor-catalog-editor__label">
              Tittel
              <input
                type="text"
                className="lp-editor-catalog-editor__input"
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
            <label className="lp-editor-catalog-editor__checkbox">
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
            <fieldset className="lp-editor-catalog-editor__allergens" disabled={item.orderLocked}>
              <legend className="lp-editor-catalog-editor__legend">Allergener</legend>
              {LUNCH_CATEGORY_ALLERGENS.map((a) => (
                <label key={a} className="lp-editor-catalog-editor__checkbox">
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
              className="lp-editor-catalog-editor__remove"
              disabled={item.orderLocked}
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
            >
              Fjern
            </button>
          </li>
        ))}
      </ul>

      <div className="lp-editor-catalog-editor__actions">
        <button
          type="button"
          className="lp-editor-catalog-editor__add"
          onClick={() => setItems((prev) => [...prev, { title: "", allergens: [], isVegetarian: false }])}
        >
          Legg til valg
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--primary lp-editor-catalog-editor__save"
          disabled={saving || items.length === 0}
          onClick={() => void saveLegacy()}
        >
          {saving ? "Lagrer…" : "Lagre katalog"}
        </button>
      </div>

      {error ? (
        <p className="lp-editor-catalog-editor__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="lp-editor-catalog-editor__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

export default function ProviderMenuCatalogEditor({
  tier,
  catalog,
  onCatalogSaved,
  initialOpenCategoryKey,
  panelMode = false,
}: Props) {
  if (panelMode) {
    return (
      <CatalogAccordionEditor
        catalog={catalog}
        onCatalogSaved={onCatalogSaved}
        initialOpenCategoryKey={initialOpenCategoryKey}
      />
    );
  }

  return <CatalogLegacyEditor tier={tier} catalog={catalog} onCatalogSaved={onCatalogSaved} />;
}

export { tierBadgeForCategoryKey, itemsForCategory, categoryLabel };
