"use client";

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import type { ProviderMenuCatalogSnapshot } from "@/lib/provider-menu/lunchCategoryCatalog";
import { providerWorkspaceCategories } from "@/lib/provider-menu/providerMenuCatalogSurface";
import {
  summarizeDayCard,
  SHARED_WARM_DISH_HINT,
  ENTERPRISE_UPGRADE_SELECTION_KEY,
  type EditorFocus,
  type WorkspaceStatusChip,
} from "@/lib/provider-menu/providerMenuWorkspace";
import { WEEKDAY_KEYS, WEEKDAY_LABELS } from "@/lib/providers/providerMenuPackageSurface";
import { menuSlotHasContent } from "@/lib/provider-menu/menuCategoryCanonical";

export type WeekSelection = {
  date: string;
  category: Category;
  variantKey?: string;
  variantLabel?: string;
  editorFocus?: EditorFocus;
};

type Props = {
  tier: PlanTier;
  catalog: ProviderMenuCatalogSnapshot;
  weekDates: string[];
  slots: Record<string, ResolvedProviderMenuSlot>;
  selected: WeekSelection | null;
  orderCountsByDate: Record<string, number>;
  onSelect: (sel: WeekSelection) => void;
};

function dayStatusClass(chip: WorkspaceStatusChip): string {
  return `lp-editor-day__status is-${chip}`;
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}`;
}

export default function ProviderMenuWeekPlanner({
  tier,
  catalog,
  weekDates,
  slots,
  selected,
  orderCountsByDate,
  onSelect,
}: Props) {
  const categories = providerWorkspaceCategories(catalog, tier);
  const hasPremium = categories.some((c) => c === "sushi" || c === "pokebowl" || c === "thai");

  return (
    <div className="lp-editor-grid-scroll">
      <div className="lp-editor-days" role="region" aria-label="Ukeplan">
        {weekDates.map((date, idx) => {
          const weekdayLabel = WEEKDAY_LABELS[WEEKDAY_KEYS[idx]!] ?? date;
          const card = summarizeDayCard(slots, date, tier, weekdayLabel, categories, catalog);
          const varmrett = card.varmrett;
          const varmrettRow = varmrett.rows[0];
          const varmrettMissing = varmrett.statusChip === "missing";
          const varmrettSelected =
            selected?.date === date &&
            selected.category === "varmrett" &&
            selected.editorFocus !== "enterprise-upgrade";
          const varmrettSlot = varmrett.slot;
          const varmrettOrderLocked = varmrettSlot?.orderLocked === true;
          const varmrettOrderCount = orderCountsByDate[date] ?? 0;
          const isFriday = WEEKDAY_KEYS[idx] === "fri";
          // Badge precedence: orderLocked > providerOverride > autoFilled
          const showGeneratedBadge =
            !varmrettMissing &&
            !varmrettOrderLocked &&
            varmrettSlot?.autoFilled === true &&
            !varmrettSlot?.providerOverride;
          const showOverrideBadge =
            !varmrettOrderLocked && varmrettSlot?.providerOverride === true;
          const costHint =
            menuSlotHasContent(varmrettSlot) && varmrettSlot.estimatedCostPerPortion != null
              ? `Kost ${varmrettSlot.estimatedCostPerPortion} kr`
              : null;
          const upgradeSelected =
            selected?.date === date && selected.editorFocus === "enterprise-upgrade";

          return (
            <article key={date} className={`lp-editor-day is-${card.dayStatus}`}>
              <header className="lp-editor-day__head">
                <div>
                  <h3 className="lp-editor-day__weekday">{weekdayLabel}</h3>
                  <time className="lp-editor-day__date" dateTime={date}>
                    {formatDisplayDate(date)}
                  </time>
                </div>
                <span className={dayStatusClass(card.dayStatus)}>{card.dayStatusLabel}</span>
              </header>

              <button
                type="button"
                className={`lp-editor-day__hero${varmrettSelected ? " is-selected" : ""}${varmrettMissing ? " is-missing" : ""}`}
                onClick={() =>
                  onSelect({
                    date,
                    category: "varmrett",
                    variantKey: "varmrett",
                    variantLabel: varmrettRow?.title,
                    editorFocus: "varmrett",
                  })
                }
              >
                <span className="lp-editor-day__hero-label">Dagens varmrett</span>
                <span className="lp-editor-day__hero-shared">{SHARED_WARM_DISH_HINT}</span>
                {varmrettMissing ? (
                  <>
                    <span className="lp-editor-day__hero-title">Varmrett mangler</span>
                    <span className="lp-editor-day__hero-hint">
                      Legg inn dagens varmrett før denne dagen kan publiseres.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="lp-editor-day__hero-title">{varmrettRow?.title ?? "Varmrett"}</span>
                    {showGeneratedBadge ? (
                      <span
                        className={`lp-editor-badge${isFriday ? " is-friday" : " is-generated"}`}
                      >
                        {isFriday ? "Fredagskos" : "Generert"}
                      </span>
                    ) : null}
                    {showOverrideBadge ? (
                      <span className="lp-editor-badge is-overridden">Overstyrt</span>
                    ) : null}
                    {varmrettOrderLocked ? (
                      <span className="lp-editor-order-lock lp-editor-day__order-lock">
                        <span className="lp-editor-order-lock__icon" aria-hidden="true">🔒</span>
                        <span className="lp-editor-order-lock__text">Har bestilling</span>
                      </span>
                    ) : null}
                    {varmrettOrderLocked && varmrettOrderCount > 0 ? (
                      <span className="lp-editor-day__order-count">
                        {varmrettOrderCount} ansatte har bestilt
                      </span>
                    ) : null}
                    {varmrettOrderLocked ? (
                      <span className="lp-editor-day__lock-hint">Åpnes etter serveringsdagen</span>
                    ) : null}
                    {costHint ? <span className="lp-editor-day__hero-meta">{costHint}</span> : null}
                    <span className="lp-editor-day__hero-status">{varmrett.statusLabel}</span>
                  </>
                )}
                <span className="lp-editor-day__hero-action">{varmrettMissing ? "Legg inn" : "Rediger"}</span>
              </button>

              {card.fixedGroups.length > 0 ? (
                <section className="lp-editor-day__group">
                  <h4 className="lp-editor-day__group-title">Faste valg</h4>
                  <ul className="lp-editor-day__group-list">
                    {card.fixedGroups.map((group) => {
                      const groupSelected =
                        selected?.date === date && selected.category === group.category && !selected.variantKey;
                      return (
                        <li key={`${date}-${group.category}`}>
                          <button
                            type="button"
                            className={`lp-editor-day__group-row${groupSelected ? " is-selected" : ""}`}
                            onClick={() => onSelect({ date, category: group.category, editorFocus: "category" })}
                          >
                            <span className="lp-editor-day__group-name">{group.categoryLabel}</span>
                            <span className="lp-editor-day__group-detail">{group.summaryLine}</span>
                            <span className="lp-editor-day__group-action">Åpne</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {hasPremium && card.premiumGroups.length > 0 ? (
                <section className="lp-editor-day__group lp-editor-day__group--premium">
                  <h4 className="lp-editor-day__group-title">Premiumvalg</h4>
                  <ul className="lp-editor-day__group-list">
                    {card.premiumGroups.map((group) => {
                      const groupSelected =
                        selected?.date === date && selected.category === group.category && !selected.variantKey;
                      return (
                        <li key={`${date}-${group.category}`}>
                          <button
                            type="button"
                            className={`lp-editor-day__group-row${groupSelected ? " is-selected" : ""}`}
                            onClick={() => onSelect({ date, category: group.category, editorFocus: "category" })}
                          >
                            <span className="lp-editor-day__group-name">{group.categoryLabel}</span>
                            <span className="lp-editor-day__group-detail">{group.summaryLine}</span>
                            <span className="lp-editor-day__group-action">Åpne</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {tier === "ENTERPRISE" && card.enterpriseUpgrade ? (
                <section className="lp-editor-day__group lp-editor-day__group--enterprise">
                  <h4 className="lp-editor-day__group-title">Enterprise-upgrade</h4>
                  <button
                    type="button"
                    className={`lp-editor-day__upgrade-row${upgradeSelected ? " is-selected" : ""}`}
                    onClick={() =>
                      onSelect({
                        date,
                        category: "varmrett",
                        variantKey: ENTERPRISE_UPGRADE_SELECTION_KEY,
                        variantLabel: card.enterpriseUpgrade?.summaryLine,
                        editorFocus: "enterprise-upgrade",
                      })
                    }
                  >
                    <span className="lp-editor-day__upgrade-title">
                      {card.enterpriseUpgrade.summaryLine}
                    </span>
                    <span className="lp-editor-day__group-action">Åpne</span>
                    <span className="lp-editor-day__upgrade-hint">Samme rett + ekstra verdi</span>
                  </button>
                </section>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
