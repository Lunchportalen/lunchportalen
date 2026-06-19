"use client";

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import { providerWorkspaceCategories } from "@/lib/provider-menu/providerMenuCatalogSurface";
import { summarizeDayCard, type WorkspaceStatusChip } from "@/lib/provider-menu/providerMenuWorkspace";
import { WEEKDAY_KEYS, WEEKDAY_LABELS } from "@/lib/providers/providerMenuPackageSurface";
import { menuSlotHasContent } from "@/lib/provider-menu/menuCategoryCanonical";

export type WeekSelection = {
  date: string;
  category: Category;
  variantKey?: string;
  variantLabel?: string;
};

type Props = {
  tier: PlanTier;
  weekDates: string[];
  slots: Record<string, ResolvedProviderMenuSlot>;
  selected: WeekSelection | null;
  onSelect: (sel: WeekSelection) => void;
};

function dayStatusClass(chip: WorkspaceStatusChip): string {
  return `menu-day-card__status is-${chip}`;
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}`;
}

export default function ProviderMenuWeekPlanner({ tier, weekDates, slots, selected, onSelect }: Props) {
  const categories = providerWorkspaceCategories(tier);
  const hasPremium = categories.some((c) => c === "sushi" || c === "pokebowl" || c === "thai");

  return (
    <div className="provider-menu-grid-scroll">
      <div className="provider-menu-days" role="region" aria-label="Ukeplanlegger">
        {weekDates.map((date, idx) => {
          const weekdayLabel = WEEKDAY_LABELS[WEEKDAY_KEYS[idx]!] ?? date;
          const card = summarizeDayCard(slots, date, tier, weekdayLabel, categories);
          const varmrett = card.varmrett;
          const varmrettRow = varmrett.rows[0];
          const varmrettMissing = varmrett.statusChip === "missing";
          const varmrettSelected =
            selected?.date === date && selected.category === "varmrett";
          const varmrettSlot = varmrett.slot;
          const costHint =
            menuSlotHasContent(varmrettSlot) && varmrettSlot.estimatedCostPerPortion != null
              ? `Kost ${varmrettSlot.estimatedCostPerPortion} kr`
              : null;

          return (
            <article key={date} className={`menu-day-card is-${card.dayStatus}`}>
              <header className="menu-day-card__head">
                <div>
                  <h3 className="menu-day-card__weekday">{weekdayLabel}</h3>
                  <time className="menu-day-card__date" dateTime={date}>
                    {formatDisplayDate(date)}
                  </time>
                </div>
                <span className={dayStatusClass(card.dayStatus)}>{card.dayStatusLabel}</span>
              </header>

              <button
                type="button"
                className={`menu-day-card__hero${varmrettSelected ? " is-selected" : ""}${varmrettMissing ? " is-missing" : ""}`}
                onClick={() =>
                  onSelect({
                    date,
                    category: "varmrett",
                    variantKey: "varmrett",
                    variantLabel: varmrettRow?.title,
                  })
                }
              >
                <span className="menu-day-card__hero-label">Dagens varmmatrett</span>
                {varmrettMissing ? (
                  <>
                    <span className="menu-day-card__hero-title">Varmrett mangler</span>
                    <span className="menu-day-card__hero-hint">Velg for å planlegge</span>
                  </>
                ) : (
                  <>
                    <span className="menu-day-card__hero-title">{varmrettRow?.title ?? "Varmrett"}</span>
                    {costHint ? <span className="menu-day-card__hero-meta">{costHint}</span> : null}
                    <span className="menu-day-card__hero-status">{varmrett.statusLabel}</span>
                  </>
                )}
              </button>

              {card.fixedGroups.length > 0 ? (
                <section className="menu-day-card__group">
                  <h4 className="menu-day-card__group-title">Faste valg</h4>
                  <ul className="menu-day-card__group-list">
                    {card.fixedGroups.map((group) => {
                      const groupSelected =
                        selected?.date === date && selected.category === group.category && !selected.variantKey;
                      return (
                        <li key={`${date}-${group.category}`}>
                          <button
                            type="button"
                            className={`menu-day-card__group-row${groupSelected ? " is-selected" : ""}`}
                            onClick={() => onSelect({ date, category: group.category })}
                          >
                            <span className="menu-day-card__group-name">
                              {group.categoryLabel} · {group.variantCount} valg
                            </span>
                            <span className="menu-day-card__group-detail">{group.summaryLine}</span>
                            <span className="menu-day-card__group-action">Åpne</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {hasPremium && card.premiumGroups.length > 0 ? (
                <section className="menu-day-card__group menu-day-card__group--premium">
                  <h4 className="menu-day-card__group-title">Premiumvalg</h4>
                  <ul className="menu-day-card__group-list">
                    {card.premiumGroups.map((group) => {
                      const groupSelected =
                        selected?.date === date && selected.category === group.category && !selected.variantKey;
                      return (
                        <li key={`${date}-${group.category}`}>
                          <button
                            type="button"
                            className={`menu-day-card__group-row${groupSelected ? " is-selected" : ""}`}
                            onClick={() => onSelect({ date, category: group.category })}
                          >
                            <span className="menu-day-card__group-name">
                              {group.categoryLabel} · {group.summaryLine}
                            </span>
                            <span className="menu-day-card__group-action">Åpne</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
