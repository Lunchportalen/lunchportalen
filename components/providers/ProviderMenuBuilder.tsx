"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import ProviderMenuCatalogView from "@/components/providers/ProviderMenuCatalogView";
import ProviderMenuCommandHeader from "@/components/providers/ProviderMenuCommandHeader";
import ProviderMenuEditorPanel from "@/components/providers/ProviderMenuEditorPanel";
import ProviderMenuStatusRow from "@/components/providers/ProviderMenuStatusRow";
import ProviderMenuWeekPlanner, {
  type WeekSelection,
} from "@/components/providers/ProviderMenuWeekPlanner";
import {
  PLAN_CATEGORIES,
  PLAN_TIERS,
  type Category,
  type PlanTier,
} from "@/lib/cms/menuDayContract";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { menuSlotHasContent } from "@/lib/provider-menu/menuCategoryCanonical";
import {
  catalogVariantByKey,
  type MenuCatalogVariant,
} from "@/lib/provider-menu/providerMenuCatalogReadModel";
import {
  mergeProviderMenuRowsIntoSlots,
  resolveProviderMenuSlot,
  type ResolvedProviderMenuSlot,
} from "@/lib/provider-menu/mergeProviderMenuSlots";
import { providerWorkspaceCategories } from "@/lib/provider-menu/providerMenuCatalogSurface";
import { isSanityDrivenCategory } from "@/lib/provider-menu/providerMenuTierContract";
import {
  buildEditorContext,
  summarizeWeekMetrics,
  summarizeCategoryDay,
  summarizeSharedVarmrettDay,
  resolveSharedVarmrettSlot,
  resolveNextStepAction,
} from "@/lib/provider-menu/providerMenuWorkspace";
import {
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  computeMarginEstimate,
  slotKey,
  validateEnterprisePublish,
  weekDatesFromStart,
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

type WorkspaceView = "week" | "catalog";

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

function weekdayLabelForDate(date: string, weekDates: string[]): string {
  const idx = weekDates.indexOf(date);
  if (idx < 0) return date;
  return WEEKDAY_LABELS[WEEKDAY_KEYS[idx]!] ?? date;
}

export default function ProviderMenuBuilder() {
  const [weekStart, setWeekStart] = useState(todayWeekStart);
  const [tier, setTier] = useState<PlanTier>("BASIS");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("week");
  const [selected, setSelected] = useState<WeekSelection | null>(null);
  const [prices, setPrices] = useState<Record<PlanTier, ProviderMenuPriceView> | null>(null);
  const [slots, setSlots] = useState<Record<string, ResolvedProviderMenuSlot>>({});
  const [form, setForm] = useState<ResolvedProviderMenuSlot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const weekDates = useMemo(() => weekDatesFromStart(weekStart), [weekStart]);
  const tierPrice = prices?.[tier];
  const workspaceCategories = useMemo(() => providerWorkspaceCategories(tier), [tier]);
  const weekMetrics = useMemo(
    () => summarizeWeekMetrics(slots, weekDates, tier, workspaceCategories),
    [slots, weekDates, tier, workspaceCategories],
  );

  /** Cockpit display-only — varmrett publish state (aligned with day-card badges). */
  const cockpitVarmrettDisplay = useMemo(() => {
    let publishedDays = 0;
    let draftDays = 0;
    for (const date of weekDates) {
      const shared = summarizeSharedVarmrettDay(slots, date);
      if (shared.statusChip === "published") publishedDays += 1;
      else if (shared.statusChip === "draft") draftDays += 1;
    }
    return { publishedDays, draftDays };
  }, [slots, weekDates]);

  const nextStepHint = useMemo(() => {
    const labels = weekDates.map((_, idx) => WEEKDAY_LABELS[WEEKDAY_KEYS[idx]!] ?? "");
    return resolveNextStepAction(slots, weekDates, tier, weekMetrics, labels);
  }, [slots, weekDates, tier, weekMetrics]);

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

  function openSelection(sel: WeekSelection) {
    setSelected(sel);
    let existing = resolveProviderMenuSlot(slots, sel.date, tier, sel.category);

    if (sel.category === "varmrett" && sel.editorFocus === "varmrett") {
      const shared = resolveSharedVarmrettSlot(slots, sel.date);
      existing = {
        ...existing,
        mealTitle: shared.mealTitle || existing.mealTitle,
        description: shared.description || existing.description,
        allergensText: shared.allergensText || existing.allergensText,
        estimatedCostPerPortion: shared.estimatedCostPerPortion ?? existing.estimatedCostPerPortion,
      };
    }

    setForm({ ...existing });
    setMessage(null);
    setError(null);
    setConfirmWarnings(false);
    setWorkspaceView("week");
  }

  function openCatalogVariant(variant: MenuCatalogVariant) {
    const firstDate = weekDates[0];
    if (!firstDate) return;
    openSelection({
      date: firstDate,
      category: variant.category,
      variantKey: variant.id.split(":")[1],
      variantLabel: variant.label,
    });
  }

  function closeEditor() {
    setSelected(null);
    setForm(null);
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

  const editorContext =
    selected && form
      ? buildEditorContext({
          tier,
          tierLabel: TIER_LABELS[tier],
          weekdayLabel: weekdayLabelForDate(selected.date, weekDates),
          date: selected.date,
          category: selected.category,
          variantLabel: selected.variantLabel ?? null,
          editorFocus: selected.editorFocus,
        })
      : null;

  const sharedVarmrettTitle =
    selected != null
      ? resolveSharedVarmrettSlot(slots, selected.date).mealTitle.trim() || null
      : null;

  const catalogVariant =
    selected?.variantKey && selected.category
      ? catalogVariantByKey(selected.category, selected.variantKey)
      : null;

  const enterpriseWarnings =
    form && tierPrice && selected?.editorFocus === "enterprise-upgrade"
      ? validateEnterprisePublish({
          tier: form.tier,
          mealTitle: form.mealTitle,
          description: form.description,
          sourcePackage: form.sourcePackage,
          upgradeType: form.upgradeType,
          upgradeNote: form.upgradeNote,
          estimatedCostPerPortion: form.estimatedCostPerPortion,
          luxusEstimatedCost:
            selected != null
              ? slots[slotKey(selected.date, "LUXUS", selected.category)]?.estimatedCostPerPortion ?? null
              : null,
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

  const categoryVariantLabels =
    selected && !selected.variantKey && !isSanityDrivenCategory(selected.category)
      ? summarizeCategoryDay(slots, selected.date, tier, selected.category).rows.map((r) => r.title)
      : undefined;

  const categoryOnly = Boolean(
    selected && !selected.variantKey && !isSanityDrivenCategory(selected.category),
  );

  const inspectorOpen = Boolean(form && selected);

  return (
    <div className="ds-provider-menu-workspace provider-menu-workspace">
      <ProviderMenuCommandHeader
        tier={tier}
        weekStart={weekStart}
        prices={prices}
        onTierChange={(t) => {
          setTier(t);
          closeEditor();
        }}
        onPrevWeek={() => setWeekStart((w) => shiftWeekStart(w, -1))}
        onNextWeek={() => setWeekStart((w) => shiftWeekStart(w, 1))}
        workspaceView={workspaceView}
        onWorkspaceViewChange={setWorkspaceView}
      />

      <ProviderMenuStatusRow
        weekStart={weekStart}
        tierLabel={TIER_LABELS[tier]}
        metrics={weekMetrics}
        varmrettPublishedDays={cockpitVarmrettDisplay.publishedDays}
        varmrettDraftDays={cockpitVarmrettDisplay.draftDays}
        priceExVatNok={tierPrice?.priceExVatNok ?? null}
        nextStep={nextStepHint}
      />

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

      <div
        className={`provider-menu-layout ds-provider-menu-workspace__body${inspectorOpen ? " is-inspector-open" : " is-inspector-idle"}${loading ? " is-week-loading" : ""}`}
      >
        <div className={`ds-provider-menu-workspace__planner${loading && !prices ? " is-initial-loading" : ""}`}>
          {workspaceView === "week" ? (
            <>
              {loading && !prices ? (
                <div className="menu-week-skeleton" aria-busy="true" aria-label="Laster meny">
                  {weekDates.map((date) => (
                    <div key={date} className="menu-week-skeleton__day" />
                  ))}
                </div>
              ) : null}
              <ProviderMenuWeekPlanner
                tier={tier}
                weekDates={weekDates}
                slots={slots}
                selected={selected}
                onSelect={openSelection}
              />
              {!inspectorOpen ? (
                <p className="menu-planner-idle-hint">
                  <span className="menu-planner-idle-hint__mark" aria-hidden="true" />
                  Velg en dag i ukeplanen for å redigere varmrett, valg eller Enterprise-upgrade.
                </p>
              ) : null}
            </>
          ) : (
            <ProviderMenuCatalogView tier={tier} onSelectVariant={openCatalogVariant} />
          )}
        </div>

        <div className="ds-provider-menu-workspace__inspector">
          <ProviderMenuEditorPanel
          open={inspectorOpen}
          context={editorContext}
          form={form}
          tier={tier}
          editorFocus={selected?.editorFocus}
          sharedVarmrettTitle={sharedVarmrettTitle}
          categoryVariantLabels={categoryVariantLabels}
          categoryOnly={categoryOnly}
          onFormChange={setForm}
          onClose={closeEditor}
          onSaveDraft={() => startTransition(() => save("draft"))}
          onPublish={() => startTransition(() => save("published"))}
          onCopyFromBasis={() => copyFromPackage("BASIS")}
          onCopyFromLuxus={() => copyFromPackage("LUXUS")}
          pending={pending}
          margin={margin}
          enterpriseWarnings={enterpriseWarnings}
          confirmWarnings={confirmWarnings}
          onConfirmWarningsChange={setConfirmWarnings}
          catalogVariantAllergens={catalogVariant?.allergens}
          imageUrl={catalogVariant?.imageUrl ?? null}
        />
        </div>
      </div>
    </div>
  );
}
