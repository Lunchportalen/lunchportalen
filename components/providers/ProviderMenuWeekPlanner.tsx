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
  return `ds-provider-menu-day__chip is-${chip}`;
}

export default function ProviderMenuWeekPlanner({ tier, weekDates, slots, selected, onSelect }: Props) {
  const categories = providerWorkspaceCategories(tier);

  return (
    <div className="ds-provider-menu-builder__grid provider-menu-week-grid" role="region" aria-label="Ukeplanlegger">
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
            const isSelected =
              selected?.date === date && selected.category === category && !selected.variantKey;

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
                    <span className="ds-provider-menu-day__varmrett-status">{row?.status}</span>
                  </button>
                </section>
              );
            }

            return (
              <section
                key={`${date}-${category}`}
                className={`ds-provider-menu-day__category${isSelected ? " is-selected" : ""}`}
              >
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
                <div className="ds-provider-menu-day__chips">
                  {summary.rows.map((row) => {
                    const key = row.variant?.key ?? row.title;
                    const chipSelected =
                      selected?.date === date &&
                      selected.category === category &&
                      selected.variantKey === key;
                    return (
                      <button
                        key={`${date}-${category}-${key}`}
                        type="button"
                        className={`ds-provider-menu-day__chip-btn${chipSelected ? " is-selected" : ""}`}
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
                    );
                  })}
                </div>
                {tier === "ENTERPRISE" && summary.rows[0]?.enterpriseUpgradeLabel ? (
                  <p className="ds-provider-menu-day__enterprise-hint">
                    {summary.rows[0].enterpriseUpgradeLabel}
                    {summary.rows[0].enterpriseUpgradeNote
                      ? ` — ${summary.rows[0].enterpriseUpgradeNote}`
                      : ""}
                  </p>
                ) : null}
              </section>
            );
          })}
        </article>
      ))}
    </div>
  );
}
