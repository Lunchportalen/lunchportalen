"use client";

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import { providerWorkspaceCategories } from "@/lib/provider-menu/providerMenuCatalogSurface";
import {
  summarizeCategoryDay,
  type CategoryDaySummary,
} from "@/lib/provider-menu/providerMenuWorkspace";
import { WEEKDAY_KEYS, WEEKDAY_LABELS } from "@/lib/providers/providerMenuPackageSurface";

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

function statusChipClass(chip: CategoryDaySummary["statusChip"]): string {
  return `ds-provider-menu-day__status is-${chip}`;
}

export default function ProviderMenuWeekPlanner({ tier, weekDates, slots, selected, onSelect }: Props) {
  const categories = providerWorkspaceCategories(tier);

  return (
    <div className="provider-menu-grid-scroll">
      <div className="provider-menu-days" role="region" aria-label="Ukeplanlegger">
        {weekDates.map((date, idx) => (
          <article key={date} className="ds-provider-menu-day">
            <header className="ds-provider-menu-day__head">
              <h3 className="ds-h4">{WEEKDAY_LABELS[WEEKDAY_KEYS[idx]!]}</h3>
              <time className="ds-provider-menu-day__date" dateTime={date}>
                {date}
              </time>
            </header>

            {categories.map((category) => {
              const summary = summarizeCategoryDay(slots, date, tier, category);

              if (summary.isSanityDriven) {
                const row = summary.rows[0];
                const isRowSelected =
                  selected?.date === date && selected.category === category && selected.variantKey === "varmrett";
                return (
                  <section
                    key={`${date}-${category}`}
                    className={`ds-provider-menu-day__varmrett${isRowSelected ? " is-selected" : ""}`}
                  >
                    <div className="ds-provider-menu-day__varmrett-head">
                      <span className="ds-provider-menu-day__cat">{summary.categoryLabel}</span>
                      <span className={statusChipClass(summary.statusChip)}>{summary.statusLabel}</span>
                    </div>
                    <button
                      type="button"
                      className="ds-provider-menu-day__varmrett-body"
                      onClick={() =>
                        onSelect({
                          date,
                          category,
                          variantKey: "varmrett",
                          variantLabel: row?.title,
                        })
                      }
                    >
                      <span className="ds-provider-menu-day__varmrett-title">{row?.title ?? "Varmrett"}</span>
                      {row?.status === "Mangler varmmat fra Sanity/bank" ? (
                        <span className="ds-provider-menu-day__varmrett-hint">Velg for å planlegge</span>
                      ) : null}
                    </button>
                  </section>
                );
              }

              return (
                <section key={`${date}-${category}`} className="ds-provider-menu-day__category">
                  <div className="ds-provider-menu-day__category-head">
                    <span className="ds-provider-menu-day__cat">{summary.categoryLabel}</span>
                    <span className={statusChipClass(summary.statusChip)}>{summary.statusLabel}</span>
                    <button
                      type="button"
                      className="ds-provider-menu-day__edit-cat"
                      onClick={() => onSelect({ date, category })}
                    >
                      Rediger
                    </button>
                  </div>
                  <ul className="ds-provider-menu-day__variants">
                    {summary.rows.map((row) => {
                      const key = row.variant?.key ?? row.title;
                      const rowSelected =
                        selected?.date === date &&
                        selected.category === category &&
                        selected.variantKey === key;
                      return (
                        <li key={`${date}-${category}-${key}`}>
                          <button
                            type="button"
                            className={`ds-provider-menu-day__variant-row${rowSelected ? " is-selected" : ""}`}
                            onClick={() =>
                              onSelect({
                                date,
                                category,
                                variantKey: key,
                                variantLabel: row.title,
                              })
                            }
                          >
                            {row.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </article>
        ))}
      </div>
    </div>
  );
}
