"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  CATEGORY_LABELS,
  PLAN_CATEGORIES,
  PLAN_TIERS,
  type Category,
  type PlanTier,
} from "@/lib/cms/menuDayContract";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import {
  contractForCategory,
  isSanityDrivenCategory,
} from "@/lib/provider-menu/basisMenuContract";
import { menuSlotHasContent } from "@/lib/provider-menu/menuCategoryCanonical";
import {
  mergeProviderMenuRowsIntoSlots,
  resolveProviderMenuSlot,
  type ResolvedProviderMenuSlot,
} from "@/lib/provider-menu/mergeProviderMenuSlots";
import {
  providerWorkspaceCategories,
  resolveVariantRowsForDay,
  summarizeWorkspaceWeekStatus,
  type ProviderVariantDisplayRow,
} from "@/lib/provider-menu/providerMenuCatalogSurface";
import {
  ENTERPRISE_UPGRADE_LABELS,
  ENTERPRISE_UPGRADE_TYPES,
  PROVIDER_MENU_BUILDER_COPY,
  WEEKDAY_LABELS,
  WEEKDAY_KEYS,
  computeMarginEstimate,
  slotKey,
  validateEnterprisePublish,
  weekDatesFromStart,
  parseAllergensDisplay,
  type EnterpriseUpgradeType,
} from "@/lib/providers/providerMenuPackageSurface";
import {
  formatPriceExVatLabel,
  formatPriceIncVatLabel,
  type ProviderMenuPriceView,
} from "@/lib/providers/providerMenuPriceDisplay";

type MenuWeekResponse = {
  ok: boolean;
  rid?: string;
  message?: string;
  data?: {
    weekStart: string;
    dates: string[];
    items: Array<{
      id: string;
      date: string;
      tier: PlanTier;
      category: Category;
      mealTitle: string;
      description: string;
      allergens: string[];
      estimatedCostPerPortion: number | null;
      sourcePackage: PlanTier | null;
      upgradeType: string | null;
      upgradeNote: string | null;
      status: "draft" | "published";
    }>;
    prices: Record<PlanTier, ProviderMenuPriceView>;
  };
};

const TIER_LABELS: Record<PlanTier, string> = {
  BASIS: "Basis",
  LUXUS: "Luxus",
  ENTERPRISE: "Enterprise",
};

function shiftWeekStart(weekStart: string, deltaWeeks: number): string {
  return addDaysISO(weekStart, deltaWeeks * 7);
}

function todayWeekStart(): string {
  return startOfWeekISO(osloTodayISODate());
}

function emptySlot(date: string, tier: PlanTier, category: Category): ResolvedProviderMenuSlot {
  return {
    date,
    tier,
    category,
    mealTitle: "",
    description: "",
    allergensText: "",
    estimatedCostPerPortion: null,
    sourcePackage: null,
    upgradeType: null,
    upgradeNote: "",
    status: "empty",
    contentSource: "empty",
  };
}

export default function ProviderMenuBuilder() {
  const [weekStart, setWeekStart] = useState(todayWeekStart);
  const [tier, setTier] = useState<PlanTier>("BASIS");
  const [selected, setSelected] = useState<{ date: string; category: Category } | null>(null);
  const [prices, setPrices] = useState<Record<PlanTier, ProviderMenuPriceView> | null>(null);
  const [slots, setSlots] = useState<Record<string, ResolvedProviderMenuSlot>>({});
  const [form, setForm] = useState<ResolvedProviderMenuSlot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const weekDates = useMemo(() => weekDatesFromStart(weekStart), [weekStart]);
  const categories = useMemo(() => providerWorkspaceCategories(tier), [tier]);
  const tierPrice = prices?.[tier];

  function variantRowClass(row: ProviderVariantDisplayRow, selected: boolean): string {
    const parts = ["ds-provider-menu-builder__variant"];
    if (selected) parts.push("is-selected");
    if (row.status === "Publisert") parts.push("is-published");
    else if (row.status === "Utkast" || row.status === "Eksisterende") parts.push("is-draft");
    else if (row.status === "Fast valg") parts.push("is-fixed");
    else parts.push("is-missing");
    return parts.join(" ");
  }

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/provider/menu-days?weekStart=${encodeURIComponent(weekStart)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const json = (await res.json()) as MenuWeekResponse;
      if (!res.ok || !json.ok || !json.data) {
        setError(json.message ?? "Kunne ikke laste meny.");
        setLoading(false);
        return;
      }
      setPrices(json.data.prices);
      const merged = mergeProviderMenuRowsIntoSlots(
        json.data.items.map((item) => ({
          ...item,
          approvedForPublish: item.status === "published",
          customerVisible: item.status === "published",
        })),
      );
      const next: Record<string, ResolvedProviderMenuSlot> = { ...merged };

      for (const date of json.data.dates) {
        for (const t of PLAN_TIERS) {
          for (const c of PLAN_CATEGORIES[t]) {
            const key = slotKey(date, t, c);
            if (!next[key]) next[key] = emptySlot(date, t, c);
          }
        }
      }

      setSlots(next);
    } catch {
      setError("Kunne ikke laste meny.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    void loadWeek();
  }, [loadWeek]);

  const weekStatus = summarizeWorkspaceWeekStatus(slots, weekDates, tier);

  function selectSlot(date: string, category: Category) {
    setSelected({ date, category });
    const existing = resolveProviderMenuSlot(slots, date, tier, category);
    setForm({ ...existing });
    setMessage(null);
    setError(null);
    setConfirmWarnings(false);
  }

  function copyFromPackage(source: PlanTier) {
    if (!form || !selected) return;
    const sourceSlot = resolveProviderMenuSlot(slots, selected.date, source, selected.category);
    if (!menuSlotHasContent(sourceSlot) && sourceSlot.status === "empty") {
      setError(`Ingen ${TIER_LABELS[source]}-meny å kopiere for denne dagen/kategorien.`);
      return;
    }
    setForm({
      ...form,
      mealTitle: sourceSlot.mealTitle,
      description: sourceSlot.description,
      allergensText: sourceSlot.allergensText,
      estimatedCostPerPortion: sourceSlot.estimatedCostPerPortion,
      sourcePackage: source,
      upgradeType: form.upgradeType,
      upgradeNote: form.upgradeNote,
      status: "draft",
      contentSource: "draft",
    });
    setMessage(`Kopiert fra ${TIER_LABELS[source]}. Legg til Enterprise-upgrade før publisering.`);
  }

  async function save(status: "draft" | "published") {
    if (!form) return;
    setError(null);
    setMessage(null);

    const luxusSlot =
      form.tier === "ENTERPRISE" && selected
        ? slots[slotKey(selected.date, "LUXUS", selected.category)]
        : null;

    const payload = {
      date: form.date,
      tier: form.tier,
      category: form.category,
      mealTitle: form.mealTitle,
      description: form.description,
      allergensText: form.allergensText || null,
      estimatedCostPerPortion: form.estimatedCostPerPortion,
      sourcePackage: form.sourcePackage,
      upgradeType: form.upgradeType,
      upgradeNote: form.upgradeNote || null,
      luxusEstimatedCost: luxusSlot?.estimatedCostPerPortion ?? null,
      confirmWarnings: status === "published" ? confirmWarnings : false,
      status,
    };

    const res = await fetch("/api/provider/menu-days", {
      method: "POST",
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as MenuWeekResponse & {
      data?: { warnings?: string[]; rid?: string; message?: string };
    };

    if (!res.ok || !json.ok) {
      const rid = json.rid ? ` (RID: ${json.rid})` : "";
      setError((json.message ?? "Kunne ikke lagre meny.") + rid);
      return;
    }

    const warnings = (json.data as { warnings?: string[] } | undefined)?.warnings ?? [];
    if (warnings.length > 0 && status === "published" && !confirmWarnings) {
      setError(`${warnings[0]} Bekreft for å publisere likevel.`);
      return;
    }

    setMessage(status === "published" ? "Meny publisert." : "Utkast lagret.");
    setConfirmWarnings(false);
    await loadWeek();
  }

  const enterpriseWarnings =
    form && tierPrice
      ? validateEnterprisePublish({
          tier: form.tier,
          mealTitle: form.mealTitle,
          description: form.description,
          sourcePackage: form.sourcePackage,
          upgradeType: form.upgradeType,
          upgradeNote: form.upgradeNote,
          estimatedCostPerPortion: form.estimatedCostPerPortion,
          luxusEstimatedCost:
            selected != null ? slots[slotKey(selected.date, "LUXUS", selected.category)]?.estimatedCostPerPortion ?? null : null,
          priceExVatNok: tierPrice.priceExVatNok,
        })
      : [];

  const margin =
    form && tierPrice
      ? computeMarginEstimate(
          {
            priceExVatNok: tierPrice.priceExVatNok,
            vatRate: tierPrice.vatRate,
            priceIncVatNok: tierPrice.priceIncVatNok,
          },
          form.estimatedCostPerPortion,
        )
      : null;

  return (
    <div className="ds-provider-menu-builder">
      <header className="ds-provider-menu-builder__header">
        <div>
          <p className="ds-body ds-provider-menu-builder__lead">{PROVIDER_MENU_BUILDER_COPY.lead}</p>
          <p className="ds-provider-menu-builder__status" role="status">
            Status: <strong>{weekStatus}</strong>
          </p>
        </div>
        <div className="ds-provider-menu-builder__week-nav">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={() => setWeekStart((w) => shiftWeekStart(w, -1))}>
            Forrige uke
          </button>
          <span className="ds-provider-menu-builder__week-label">Uke fra {weekStart}</span>
          <button type="button" className="ds-btn ds-btn--ghost" onClick={() => setWeekStart((w) => shiftWeekStart(w, 1))}>
            Neste uke
          </button>
        </div>
      </header>

      <div className="ds-provider-menu-builder__tabs" role="tablist" aria-label="Menypakker">
        {PLAN_TIERS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tier === t}
            className={`ds-provider-menu-builder__tab${tier === t ? " is-active" : ""}`}
            onClick={() => {
              setTier(t);
              setSelected(null);
              setForm(null);
            }}
          >
            {TIER_LABELS[t]}
            {prices?.[t] ? (
              <span className="ds-provider-menu-builder__tab-price">
                {formatPriceExVatLabel(prices[t].priceExVatNok)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tierPrice ? (
        <p className="ds-provider-menu-builder__price-banner">
          {formatPriceExVatLabel(tierPrice.priceExVatNok)} · {formatPriceIncVatLabel(tierPrice.priceIncVatNok)}
          {tierPrice.source === "provider_price_rules" ? " (leverandørpris)" : " (standardpris)"}
        </p>
      ) : null}

      {loading ? <p className="ds-body">Laster meny…</p> : null}
      {error ? (
        <p className="ds-provider-menu-builder__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="ds-provider-success" role="status">
          {message}
        </p>
      ) : null}

      <div className="ds-provider-menu-builder__grid provider-menu-week-grid">
        {weekDates.map((date, idx) => (
          <div key={date} className="ds-provider-menu-builder__day-col">
            <h3 className="ds-h4">{WEEKDAY_LABELS[WEEKDAY_KEYS[idx]!]}</h3>
            <p className="ds-provider-menu-builder__day-date">{date}</p>
            {categories.map((category) => {
              const contract = contractForCategory(category);
              const rows = resolveVariantRowsForDay(slots, date, tier, category);
              const isCategorySelected = selected?.date === date && selected.category === category;
              return (
                <section key={`${date}-${category}`} className="ds-provider-menu-builder__category-block">
                  <div className="ds-provider-menu-builder__category-head">
                    <h4 className="ds-provider-menu-builder__category-title">
                      {contract?.categoryLabel ?? CATEGORY_LABELS[category]}
                    </h4>
                    {!isSanityDrivenCategory(category) ? (
                      <button
                        type="button"
                        className="ds-btn ds-btn--ghost ds-provider-menu-builder__category-edit"
                        onClick={() => selectSlot(date, category)}
                      >
                        Publiser kategori
                      </button>
                    ) : null}
                  </div>
                  {rows.map((row) => {
                    const rowKey = row.variant?.key ?? `${category}-varmrett`;
                    const isSelected = isCategorySelected && row.editable;
                    const className = variantRowClass(row, isSelected);
                    if (!row.editable) {
                      return (
                        <div key={`${date}-${category}-${rowKey}`} className={className}>
                          <span className="ds-provider-menu-builder__cell-title">{row.title}</span>
                          <span className="ds-provider-menu-builder__cell-status">{row.status}</span>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={`${date}-${category}-${rowKey}`}
                        type="button"
                        className={className}
                        onClick={() => selectSlot(date, category)}
                      >
                        <span className="ds-provider-menu-builder__cell-title">{row.title}</span>
                        <span className="ds-provider-menu-builder__cell-status">{row.status}</span>
                      </button>
                    );
                  })}
                </section>
              );
            })}
          </div>
        ))}
      </div>

      {form ? (
        <section className="ds-card ds-provider-menu-builder__editor" aria-label="Rediger meny">
          <h3 className="ds-h4">
            {TIER_LABELS[form.tier]} · {form.date} · {CATEGORY_LABELS[form.category]}
          </h3>
          {!isSanityDrivenCategory(form.category) ? (
            <p className="ds-body ds-provider-menu-builder__fixed-note">
              Faste valg hentes fra lunchCategory-katalogen. Publiser kategorien for å aktivere
              levering — variantene under er allerede definert.
            </p>
          ) : null}

          <label className="ds-provider-menu-builder__field">
            Rettens navn
            <input
              value={form.mealTitle}
              onChange={(e) => setForm({ ...form, mealTitle: e.target.value })}
              maxLength={120}
            />
          </label>

          <label className="ds-provider-menu-builder__field">
            Beskrivelse
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={4000}
            />
          </label>

          <label className="ds-provider-menu-builder__field">
            Allergener (kommaseparert)
            <input
              value={form.allergensText}
              onChange={(e) => setForm({ ...form, allergensText: e.target.value })}
              placeholder="F.eks. melk, hvete"
            />
          </label>

          <label className="ds-provider-menu-builder__field">
            Estimert råvarekost (kr)
            <input
              type="number"
              min={0}
              max={90}
              step={0.5}
              value={form.estimatedCostPerPortion ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  estimatedCostPerPortion: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>

          {margin ? (
            <div className="ds-provider-menu-builder__margin">
              <p>
                Pris eks. mva: <strong>{formatPriceExVatLabel(margin.priceExVatNok)}</strong>
              </p>
              {margin.estimatedCostNok != null ? (
                <>
                  <p>
                    Estimert kost: <strong>{margin.estimatedCostNok.toLocaleString("nb-NO")} kr</strong>
                  </p>
                  <p>
                    Estimert bruttofortjeneste:{" "}
                    <strong>{margin.grossMarginNok?.toLocaleString("nb-NO") ?? "—"} kr</strong>
                    {margin.marginPercent != null ? ` (${margin.marginPercent} %)` : ""}
                  </p>
                </>
              ) : null}
            </div>
          ) : null}

          {form.tier === "ENTERPRISE" ? (
            <fieldset className="ds-provider-menu-builder__enterprise">
              <legend>Enterprise-verdi</legend>
              <div className="ds-provider-menu-builder__copy-actions">
                <button type="button" className="ds-btn ds-btn--ghost" onClick={() => copyFromPackage("BASIS")}>
                  Bygg fra Basis
                </button>
                <button type="button" className="ds-btn ds-btn--ghost" onClick={() => copyFromPackage("LUXUS")}>
                  Bygg fra Luxus
                </button>
              </div>
              <label className="ds-provider-menu-builder__field">
                Basert på
                <select
                  value={form.sourcePackage ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sourcePackage: (e.target.value as PlanTier) || null,
                    })
                  }
                >
                  <option value="">Ingen</option>
                  <option value="BASIS">Basis</option>
                  <option value="LUXUS">Luxus</option>
                </select>
              </label>
              <label className="ds-provider-menu-builder__field">
                Upgrade-type
                <select
                  value={form.upgradeType ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      upgradeType: (e.target.value as EnterpriseUpgradeType) || null,
                    })
                  }
                >
                  <option value="">Velg type</option>
                  {ENTERPRISE_UPGRADE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ENTERPRISE_UPGRADE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ds-provider-menu-builder__field">
                Upgrade-beskrivelse
                <textarea
                  rows={2}
                  value={form.upgradeNote}
                  onChange={(e) => setForm({ ...form, upgradeNote: e.target.value })}
                  maxLength={500}
                />
              </label>
              {enterpriseWarnings.map((w) => (
                <p
                  key={w.code}
                  className={w.blocking ? "ds-provider-menu-builder__error" : "ds-provider-menu-builder__warn"}
                  role="status"
                >
                  {w.message}
                </p>
              ))}
            </fieldset>
          ) : null}

          {enterpriseWarnings.some((w) => !w.blocking) ? (
            <label className="ds-provider-menu-builder__confirm">
              <input
                type="checkbox"
                checked={confirmWarnings}
                onChange={(e) => setConfirmWarnings(e.target.checked)}
              />
              Jeg bekrefter publisering til tross for advarsel.
            </label>
          ) : null}

          <div className="ds-provider-meny-actions">
            <button
              type="button"
              className="ds-btn"
              disabled={pending}
              onClick={() => startTransition(() => save("draft"))}
            >
              {pending ? "Lagrer…" : "Lagre utkast"}
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              disabled={pending}
              onClick={() => startTransition(() => save("published"))}
            >
              {pending ? "Publiserer…" : "Publiser"}
            </button>
          </div>
        </section>
      ) : (
        <p className="ds-body">Velg varmmat eller «Publiser kategori» for å redigere meny.</p>
      )}
    </div>
  );
}
