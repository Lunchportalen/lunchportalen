"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import type { ProviderMenuGeneratorPreviewPresentation } from "@/lib/provider-menu/providerMenuGeneratorPresentation";
import type { ApplyOverwriteMode } from "@/lib/menu-generator/applyTypes";
import { LOCALIZED_MENU_GENERATOR_VERSION } from "@/lib/menu-generator/applyTypes";
import { startOfWeekISO } from "@/lib/date/oslo";

type CategoryDiff = {
  categoryKey: string;
  displayName: string;
  status: string;
  providerLabel: string;
  generatedItemCount: number;
  addedItems: string[];
  changedItems: string[];
  blockedReason: string | null;
  itemChanges?: Array<{ slug: string; title: string; change: string }>;
};

type ApplyResponse = {
  ok: boolean;
  mode: "dry_run" | "apply";
  generatorVersion: string;
  categoryScope: string;
  capabilities?: {
    canApplyFullMenu: boolean;
    supportedCategories: string[];
    unsupportedCategories: string[];
    warnings: string[];
  };
  summary: {
    createdDraftDays: number;
    updatedDraftDays: number;
    createdCategories: number;
    updatedCategories: number;
    skippedExistingCategories: number;
    blockedPublishedCategories: number;
    unsupportedCategories: number;
    unchangedCategories: number;
    totalGeneratedDays: number;
    totalGeneratedCategories: number;
    totalGeneratedItems: number;
  };
  days: Array<{
    date: string;
    weekday: string;
    categories: CategoryDiff[];
  }>;
  catalogCategories: CategoryDiff[];
  warnings: string[];
  blockedReasons: string[];
  errorCode?: string;
  message?: string;
  audit?: { appliedDates: string[]; appliedCatalogCategories: string[] };
};

type Props = {
  presentation: Extract<ProviderMenuGeneratorPreviewPresentation, { active: true }>;
  canApply: boolean;
};

const OVERWRITE_MODES: { value: ApplyOverwriteMode; label: string }[] = [
  { value: "stop_if_published_exists", label: "Stopp hvis publisert dag finnes" },
  { value: "create_missing_only", label: "Opprett kun manglende utkast" },
  { value: "replace_drafts_only", label: "Erstatt kun utkast" },
  { value: "stop_if_any_day_exists", label: "Stopp hvis uke allerede har innhold" },
];

function badgeClass(status: string): string {
  if (status.includes("would_") || status.includes("create") || status.includes("update") || status.includes("replace")) {
    return "lp-gen-apply-badge--action";
  }
  if (status.includes("skip") || status === "unchanged") return "lp-gen-apply-badge--skip";
  if (status.includes("block") || status.includes("unsupported") || status === "failed") return "lp-gen-apply-badge--block";
  return "lp-gen-apply-badge--neutral";
}

export default function ProviderMenuGeneratorApplyFlow({ presentation, canApply }: Props) {
  const [weekStart, setWeekStart] = useState(presentation.weekStart);
  const [overwriteMode, setOverwriteMode] = useState<ApplyOverwriteMode>("stop_if_published_exists");
  const [dryRunResult, setDryRunResult] = useState<ApplyResponse | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const mondayWeekStart = useMemo(() => startOfWeekISO(weekStart), [weekStart]);

  const callApply = useCallback(
    async (dryRun: boolean) => {
      setError(null);
      const res = await fetch("/api/provider/menu-generator/apply-week", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          weekStart: mondayWeekStart,
          packageTier: "LUXUS",
          overwriteMode,
          categoryScope: "all_supported",
          dryRun,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: ApplyResponse;
        message?: string;
      };
      const data = json.data ?? (json as ApplyResponse);
      if (!res.ok || json.ok === false) {
        setError(json.message ?? data.message ?? "Forespørselen feilet.");
        if (dryRun && data.days) setDryRunResult(data);
        return null;
      }
      return data;
    },
    [mondayWeekStart, overwriteMode],
  );

  const onDryRun = () => {
    startTransition(async () => {
      const data = await callApply(true);
      if (data) {
        setDryRunResult(data);
        setApplyResult(null);
      }
    });
  };

  const onApply = () => {
    startTransition(async () => {
      setConfirmOpen(false);
      const data = await callApply(false);
      if (data) setApplyResult(data);
    });
  };

  const result = applyResult ?? dryRunResult;
  const blocked = (result?.blockedReasons.length ?? 0) > 0;
  const unsupported = (result?.summary.unsupportedCategories ?? 0) > 0;
  const wouldMutate =
    (result?.summary.createdDraftDays ?? 0) +
      (result?.summary.updatedDraftDays ?? 0) +
      (result?.summary.createdCategories ?? 0) +
      (result?.summary.updatedCategories ?? 0) >
    0;
  const ready = presentation.fixedDishBankStatus.meetsMinimums;

  return (
    <div className="lp-gen-apply" data-testid="provider-menu-generator-apply">
      <h3 className="ds-h4">Bruk lokal fast ukemeny</h3>
      <p className="ds-body ds-muted">
        Dette lager menyutkast. Dette publiserer ikke automatisk. Dette påvirker ikke eksisterende ordre.
        Publiserte dager overskrives ikke. Menyinnhold følger providerens menyprofil, ikke brukerens UI-språk.
        Faste kategorier oppdateres som ukens katalogutkast, ikke som egne per-dag-kategorier.
      </p>

      <dl className="ds-kv-grid">
        <div>
          <dt>Menylocale</dt>
          <dd>{presentation.menuLocale}</dd>
        </div>
        <div>
          <dt>Land / valuta</dt>
          <dd>
            {presentation.country} · {presentation.currency}
          </dd>
        </div>
        <div>
          <dt>Menyprofil</dt>
          <dd>{presentation.menuProfileId}</dd>
        </div>
        <div>
          <dt>Generator</dt>
          <dd data-testid="generator-readiness">
            v{LOCALIZED_MENU_GENERATOR_VERSION} · {ready ? "Klar" : "Ikke klar"}
          </dd>
        </div>
        <div>
          <dt>Omfang</dt>
          <dd data-testid="apply-category-scope">all_supported</dd>
        </div>
        <div>
          <dt>Publisert beskyttelse</dt>
          <dd>Aktiv server-side</dd>
        </div>
      </dl>

      {result?.capabilities ? (
        <p className="ds-body ds-muted" data-testid="apply-capabilities">
          Støttede kategorier: {result.capabilities.supportedCategories.join(", ")}
          {result.capabilities.unsupportedCategories.length
            ? ` · Blokkert schema: ${result.capabilities.unsupportedCategories.join(", ")} (vegetarian krever schema-støtte)`
            : null}
        </p>
      ) : null}

      <div className="lp-gen-apply-controls">
        <label className="ds-field">
          <span className="ds-label">Uke (mandag)</span>
          <input
            type="date"
            className="ds-input"
            value={mondayWeekStart}
            onChange={(e) => {
              setWeekStart(startOfWeekISO(e.target.value));
              setDryRunResult(null);
              setApplyResult(null);
            }}
            disabled={!canApply || pending}
          />
        </label>
        <label className="ds-field">
          <span className="ds-label">Overwrite-regel</span>
          <select
            className="ds-input"
            value={overwriteMode}
            onChange={(e) => {
              setOverwriteMode(e.target.value as ApplyOverwriteMode);
              setDryRunResult(null);
              setApplyResult(null);
            }}
            disabled={!canApply || pending}
          >
            {OVERWRITE_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="lp-gen-apply-actions">
        <button
          type="button"
          className="ds-btn ds-btn-secondary"
          onClick={onDryRun}
          disabled={!canApply || pending || !ready}
          data-testid="generator-dry-run-btn"
        >
          {pending ? "Arbeider…" : "Forhåndsvis endringer"}
        </button>
        <button
          type="button"
          className="ds-btn ds-btn-primary"
          onClick={() => setConfirmOpen(true)}
          disabled={!canApply || pending || !dryRunResult || !wouldMutate || blocked || !ready}
          data-testid="generator-apply-btn"
        >
          Bruk denne ukemenyen som utkast
        </button>
      </div>

      {confirmOpen ? (
        <div className="lp-gen-apply-confirm" role="dialog" aria-modal="true" data-testid="generator-apply-confirm">
          <p className="ds-body">
            Dette oppretter/oppdaterer menyutkast for alle støttede kategorier. Det publiserer ikke automatisk og
            påvirker ikke eksisterende ordre. Publiserte dager overskrives ikke.
          </p>
          <div className="lp-gen-apply-actions">
            <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setConfirmOpen(false)}>
              Avbryt
            </button>
            <button type="button" className="ds-btn ds-btn-primary" onClick={onApply}>
              Bekreft apply
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="lp-editor-builder__error" role="alert" data-testid="generator-apply-error">
          {error}
        </p>
      ) : null}

      {applyResult?.ok ? (
        <p className="ds-body" role="status" data-testid="generator-apply-success">
          Utkast lagret ({applyResult.audit?.appliedDates.length ?? 0} dager,{" "}
          {applyResult.audit?.appliedCatalogCategories.length ?? 0} katalogkategorier). Publiser manuelt når du er klar.
        </p>
      ) : null}

      {result ? (
        <section className="lp-gen-apply-diff" data-testid="generator-apply-diff">
          <h4 className="ds-h4">Diff-sammendrag</h4>
          <ul className="ds-list lp-gen-apply-summary">
            <li>Dager opprettes: {result.summary.createdDraftDays}</li>
            <li>Dager oppdateres: {result.summary.updatedDraftDays}</li>
            <li>Kategorier opprettes: {result.summary.createdCategories}</li>
            <li>Kategorier oppdateres: {result.summary.updatedCategories}</li>
            <li>Items generert: {result.summary.totalGeneratedItems}</li>
            <li>Publisert blokkert: {result.summary.blockedPublishedCategories}</li>
            <li>Schema unsupported: {result.summary.unsupportedCategories}</li>
            <li>Uendret: {result.summary.unchangedCategories}</li>
          </ul>

          {unsupported ? (
            <p className="ds-body" role="status" data-testid="unsupported-categories-notice">
              Noen genererte kategorier støttes ikke av dagens schema og applyes ikke.
            </p>
          ) : null}

          {result.blockedReasons.map((r) => (
            <p key={r} className="lp-gen-apply-warnings" role="alert">
              {r}
            </p>
          ))}

          {result.catalogCategories.length ? (
            <>
              <h5 className="ds-h4">Katalogkategorier (uke-aggregert)</h5>
              <ul className="lp-gen-apply-days">
                {result.catalogCategories.map((cat) => (
                  <li key={cat.categoryKey} className="lp-gen-apply-day">
                    <div className="lp-gen-apply-day-head">
                      <strong>{cat.displayName}</strong>
                      <span className={`lp-gen-apply-badge ${badgeClass(cat.status)}`}>{cat.providerLabel}</span>
                    </div>
                    <p className="ds-body ds-muted">
                      {cat.generatedItemCount} retter · +{cat.addedItems.length} · ~{cat.changedItems.length}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h5 className="ds-h4">Dag-for-dag</h5>
          <ul className="lp-gen-apply-days">
            {result.days.map((day) => (
              <li key={day.date} className="lp-gen-apply-day">
                <strong>
                  {day.weekday} · {day.date}
                </strong>
                <ul className="ds-list">
                  {day.categories.map((cat) => (
                    <li key={`${day.date}-${cat.categoryKey}`}>
                      {cat.displayName}: {cat.providerLabel}
                      {cat.itemChanges?.[0] ? ` — ${cat.itemChanges[0].title}` : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
