"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import type { ProviderMenuCatalogSnapshot } from "@/lib/provider-menu/lunchCategoryCatalog";
import { getWeekdayCategoryPin } from "@/lib/menu-publish/generateWeekMenu";
import { providerWorkspaceCategories } from "@/lib/provider-menu/providerMenuCatalogSurface";
import {
  summarizeDayCard,
  ENTERPRISE_UPGRADE_SELECTION_KEY,
  type EditorFocus,
  type WorkspaceStatusChip,
} from "@/lib/provider-menu/providerMenuWorkspace";
import { WEEKDAY_KEYS, type WeekdayKey } from "@/lib/providers/providerMenuPackageSurface";
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
  profileCategoryLabels?: Partial<Record<Category, string>>;
  onSelect: (sel: WeekSelection) => void;
};

const ENTERPRISE_UPGRADE_DELTA = 40;

const CATEGORY_PIN_KEYS: Record<string, "soup" | "fish" | "fridayTreat"> = {
  suppe: "soup",
  fisk: "fish",
  fredagskos: "fridayTreat",
};

const CATEGORY_PIN_CLASS: Record<string, { classSuffix: string; icon: string }> = {
  suppe: { classSuffix: "suppe", icon: "🍲" },
  fisk: { classSuffix: "fish", icon: "🐟" },
  fredagskos: { classSuffix: "fri", icon: "🎉" },
};

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}`;
}

function catRowState(chip: WorkspaceStatusChip): "done" | "todo" {
  if (chip === "published" || chip === "fixed") return "done";
  return "todo";
}

export default function ProviderMenuWeekPlanner({
  tier,
  catalog,
  weekDates,
  slots,
  selected,
  orderCountsByDate,
  profileCategoryLabels,
  onSelect,
}: Props) {
  const t = useTranslations("provider.menu");
  const categories = providerWorkspaceCategories(catalog, tier);
  const hasPremium = categories.some((c) => c === "sushi" || c === "pokebowl" || c === "thai");

  const weekdayLabels = useMemo(
    () =>
      Object.fromEntries(
        WEEKDAY_KEYS.map((key) => [key, t(`weekdays.${key as WeekdayKey}`)]),
      ) as Record<WeekdayKey, string>,
    [t],
  );

  return (
    <div className="lp-editor-grid-scroll">
      <div className="lp-editor-days" role="region" aria-label={t("week.ariaLabel")}>
        {weekDates.map((date, idx) => {
          const weekdayKey = WEEKDAY_KEYS[idx]!;
          const weekdayLabel = weekdayLabels[weekdayKey] ?? date;
          const card = summarizeDayCard(
            slots,
            date,
            tier,
            weekdayLabel,
            categories,
            catalog,
            profileCategoryLabels,
          );
          const varmrett = card.varmrett;
          const varmrettRow = varmrett.rows[0];
          const varmrettMissing = varmrett.statusChip === "missing";
          const varmrettSlot = varmrett.slot;
          const varmrettOrderLocked = varmrettSlot?.orderLocked === true;
          const varmrettOrderCount = orderCountsByDate[date] ?? 0;
          const isFriday = weekdayKey === "fri";
          const isDaySelected = selected?.date === date;
          const pinTag = getWeekdayCategoryPin(idx);
          const pinKey = pinTag ? CATEGORY_PIN_KEYS[pinTag] : null;
          const pinClass = pinTag ? CATEGORY_PIN_CLASS[pinTag] : null;

          const showGeneratedBadge =
            !varmrettMissing &&
            !varmrettOrderLocked &&
            varmrettSlot?.autoFilled === true &&
            !varmrettSlot?.providerOverride;
          const showOverrideBadge =
            !varmrettOrderLocked && varmrettSlot?.providerOverride === true;
          const costHint =
            menuSlotHasContent(varmrettSlot) && varmrettSlot.estimatedCostPerPortion != null
              ? t("week.costHint", { amount: varmrettSlot.estimatedCostPerPortion })
              : null;

          const allergensText = varmrettSlot?.allergensText?.trim() ?? "";
          const allergenNote = varmrettOrderLocked
            ? t("week.allergens.opensAfterDelivery")
            : allergensText
              ? t("week.allergens.confirmed", { list: allergensText })
              : t("week.allergens.unconfirmed");

          const premiumLabels = card.premiumGroups.map((g) => g.categoryLabel);
          const premiumCount = card.premiumGroups.reduce((sum, g) => sum + g.variantCount, 0);
          const premiumDone =
            card.premiumGroups.length > 0 &&
            card.premiumGroups.every((g) => catRowState(g.statusChip) === "done");

          const upgradeDone =
            card.enterpriseUpgrade != null && catRowState(card.enterpriseUpgrade.statusChip) === "done";

          function selectDay(focus: EditorFocus = "varmrett") {
            onSelect({
              date,
              category: focus === "enterprise-upgrade" ? "varmrett" : "varmrett",
              variantKey: focus === "enterprise-upgrade" ? ENTERPRISE_UPGRADE_SELECTION_KEY : "varmrett",
              variantLabel: varmrettRow?.title,
              editorFocus: focus,
            });
          }

          function selectCategory(category: Category) {
            onSelect({ date, category, editorFocus: "category" });
          }

          return (
            <article
              key={date}
              className={`lp-editor-day${isDaySelected ? " is-selected" : ""}${varmrettMissing ? " is-missing" : ""}${varmrettOrderLocked ? " is-locked" : ""}`}
              onClick={() => selectDay("varmrett")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectDay("varmrett");
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={isDaySelected}
              aria-label={`${weekdayLabel} ${formatDisplayDate(date)}`}
            >
              <div className="lp-editor-day__top">
                <span className="lp-editor-day__weekday">{weekdayLabel}</span>
                <time className="lp-editor-day__date" dateTime={date}>
                  {formatDisplayDate(date)}
                </time>
              </div>

              <div className="lp-editor-day__hero">
                <div className="lp-editor-day__hero-inner">
                  <div className="lp-editor-day__eyebrow">{t("week.hotMealEyebrow")}</div>
                  {varmrettMissing ? (
                  <>
                    <div className="lp-editor-day__name">{t("week.hotMealMissing")}</div>
                    <p className="lp-editor-day__hint">{t("week.hotMealMissingHint")}</p>
                  </>
                ) : (
                  <>
                    <div className="lp-editor-day__name">{varmrettRow?.title ?? t("week.hotMealFallback")}</div>
                    <div className="lp-editor-day__sub">
                      {showGeneratedBadge ? (
                        <span
                          className={`lp-editor-badge lp-editor-day__badge${isFriday ? " is-friday" : " is-generated"}`}
                        >
                          {isFriday ? t("week.badges.fridayTreat") : t("week.badges.generated")}
                        </span>
                      ) : null}
                      {showOverrideBadge ? (
                        <span className="lp-editor-badge lp-editor-day__badge is-overridden">
                          {t("week.badges.overridden")}
                        </span>
                      ) : null}
                      {varmrettOrderLocked ? (
                        <span className="lp-editor-badge lp-editor-day__badge is-order-lock">
                          {t("week.badges.hasOrder")}
                        </span>
                      ) : null}
                      {costHint ? <span className="lp-editor-day__kost">{costHint}</span> : null}
                    </div>
                  </>
                )}
                </div>
              </div>

              {pinKey && pinClass ? (
                <span className={`lp-editor-day__pin lp-editor-day__pin--${pinClass.classSuffix}`}>
                  <span aria-hidden="true">{pinClass.icon}</span>
                  {t(`week.pins.${pinKey}`)}
                </span>
              ) : null}

              {varmrettOrderLocked ? (
                <div className="lp-editor-day__lockbar" role="status">
                  <span aria-hidden="true">🔒</span>
                  {varmrettOrderCount > 0
                    ? t("week.orderLock.hasOrderWithPortions", { count: varmrettOrderCount })
                    : t("week.orderLock.hasOrderLocked")}
                </div>
              ) : null}

              <div className="lp-editor-day__catline">
                {card.fixedGroups.map((group) => {
                  const done = catRowState(group.statusChip) === "done";
                  return (
                    <button
                      key={`${date}-${group.category}`}
                      type="button"
                      className={`lp-editor-day__catrow${done ? " is-done" : " is-todo"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectCategory(group.category);
                      }}
                    >
                      <span className="lp-editor-day__catrow-icon" aria-hidden="true">
                        {done ? "✓" : "+"}
                      </span>
                      <span className="lp-editor-day__catrow-label">{group.categoryLabel}</span>
                      <span className="lp-editor-day__catrow-n">{group.variantCount}</span>
                    </button>
                  );
                })}

                {hasPremium && card.premiumGroups.length > 0 ? (
                  <button
                    type="button"
                    className={`lp-editor-day__catrow lp-editor-prem${premiumDone ? " is-done" : " is-todo"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const first = card.premiumGroups[0];
                      if (first) selectCategory(first.category);
                    }}
                  >
                    <span className="lp-editor-day__catrow-icon" aria-hidden="true">
                      {premiumDone ? "✓" : "+"}
                    </span>
                    <span className="lp-editor-day__catrow-label">
                      {premiumLabels.join(" · ")}
                    </span>
                    <span className="lp-editor-day__catrow-n">{premiumCount}</span>
                  </button>
                ) : null}

                {tier === "ENTERPRISE" && card.enterpriseUpgrade ? (
                  <button
                    type="button"
                    className={`lp-editor-day__catrow lp-editor-prem lp-editor-day__catrow--upgrade${upgradeDone ? " is-done" : " is-todo"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectDay("enterprise-upgrade");
                    }}
                  >
                    <span className="lp-editor-day__catrow-icon" aria-hidden="true">
                      {upgradeDone ? "✓" : "+"}
                    </span>
                    <span className="lp-editor-day__catrow-label">{t("week.enterpriseUpgrade")}</span>
                    <span className="lp-editor-day__catrow-n">+{ENTERPRISE_UPGRADE_DELTA}</span>
                  </button>
                ) : null}
              </div>

              <p className="lp-editor-day__allerg">
                <span aria-hidden="true">ℹ</span>
                {allergenNote}
              </p>

              <button
                type="button"
                className={`lp-editor-day__editbtn${varmrettOrderLocked ? " is-locked" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  selectDay(
                    varmrettOrderLocked ? "varmrett" : selected?.date === date ? "varmrett" : "varmrett",
                  );
                }}
              >
                <span aria-hidden="true">{varmrettOrderLocked ? "👁" : "✎"}</span>
                {varmrettMissing
                  ? t("week.actions.add")
                  : varmrettOrderLocked
                    ? t("week.actions.viewDay")
                    : isDaySelected
                      ? t("week.actions.editNow")
                      : t("week.actions.edit")}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
