"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import type { ProviderMenuGeneratorPreviewPresentation } from "@/lib/provider-menu/providerMenuGeneratorPresentation";
import type { ApplyOverwriteMode } from "@/lib/menu-generator/applyTypes";
import { startOfWeekISO } from "@/lib/date/oslo";

type ApplyDayRow = {
  date: string;
  weekday: string;
  status: string;
  providerLabel: string;
  generatedState: { mealTitle: string; description: string } | null;
  diff: Array<{ field: string; before: string; after: string }>;
  warnings: string[];
};

type ApplyResponse = {
  ok: boolean;
  mode: "dry_run" | "apply";
  summary: {
    createdDraftDays: number;
    updatedDraftDays: number;
    skippedExistingDays: number;
    skippedPublishedDays: number;
    blockedPublishedDays: number;
    unchangedDays: number;
    totalGeneratedDays: number;
    failedDays: number;
  };
  days: ApplyDayRow[];
  warnings: string[];
  blockedReasons: string[];
  errorCode?: string;
  message?: string;
};

type Props = {
  presentation: ProviderMenuGeneratorPreviewPresentation;
  canApply: boolean;
  initialWeekStart?: string;
};

const OVERWRITE_MODES: { value: ApplyOverwriteMode; label: string }[] = [
  { value: "stop_if_published_exists", label: "Stopp hvis publisert dag finnes" },
  { value: "create_missing_only", label: "Opprett kun manglende utkast" },
  { value: "replace_drafts_only", label: "Erstatt kun utkast" },
  { value: "stop_if_any_day_exists", label: "Stopp hvis uke allerede har innhold" },
];

function statusBadgeClass(status: string): string {
  if (status.startsWith("would_") || status === "created" || status === "updated_draft") return "lp-gen-apply-badge--action";
  if (status.startsWith("skipped") || status === "unchanged") return "lp-gen-apply-badge--skip";
  if (status.startsWith("blocked") || status === "failed") return "lp-gen-apply-badge--block";
  return "lp-gen-apply-badge--neutral";
}

export default function ProviderMenuGeneratorApplyFlow({
  presentation,
  canApply,
  initialWeekStart,
}: Props) {
  if (!presentation.active) return null;

  const defaultWeek = initialWeekStart ?? presentation.weekStart;
  const [weekStart, setWeekStart] = useState(defaultWeek);
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
          dryRun,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: ApplyResponse; message?: string; error?: string };
      const data = json.data ?? (json as ApplyResponse);
      if (!res.ok || json.ok === false) {
        const msg = json.message ?? data.message ?? "Forespørselen feilet.";
        setError(msg);
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
      if (data) {
        setApplyResult(data);
        setDryRunResult(data.mode === "dry_run" ? data : dryRunResult);
      }
    });
  };

  const wouldMutate = dryRunResult?.days.some(
    (d) => d.status === "would_create" || d.status === "would_update_draft",
  );
  const blocked = (dryRunResult?.blockedReasons.length ?? 0) > 0;
  const replaceDrafts = overwriteMode === "replace_drafts_only";

  return (
    <div className="lp-gen-apply" data-testid="provider-menu-generator-apply">
      <h3 className="ds-h4">Bruk lokal fast ukemeny</h3>
      <p className="ds-body ds-muted">
        Dette lager menyutkast. Dette publiserer ikke automatisk. Dette påvirker ikke eksisterende ordre.
        Publiserte dager overskrives ikke. Menyinnhold følger providerens menyprofil, ikke brukerens UI-språk.
      </p>

      <dl className="ds-kv-grid">
        <div>
          <dt>Menyprofil</dt>
          <dd>{presentation.menuProfileId}</dd>
        </div>
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
          <dt>Generator</dt>
          <dd data-testid="generator-readiness">{presentation.fixedDishBankStatus.meetsMinimums ? "Klar" : "Ikke klar"}</dd>
        </div>
      </dl>

      <div className="lp-gen-apply-controls">
        <label className="ds-field">
          <span className="ds-label">Uke (mandag)</span>
          <input
            type="date"
            className="ds-input"
            value={mondayWeekStart}
            onChange={(e) => setWeekStart(startOfWeekISO(e.target.value))}
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

      <p className="ds-body ds-muted lp-gen-apply-notice" role="note">
        Publisert beskyttelse er aktiv server-side. Faste kategorier (påsmurt/salat) kommer fra katalog — apply
        oppretter varmrett-utkast for ukedagene.
      </p>

      <div className="lp-gen-apply-actions">
        <button
          type="button"
          className="ds-btn ds-btn-secondary"
          onClick={onDryRun}
          disabled={!canApply || pending || !presentation.fixedDishBankStatus.meetsMinimums}
          data-testid="generator-dry-run-btn"
        >
          {pending ? "Arbeider…" : "Forhåndsvis endringer"}
        </button>
        <button
          type="button"
          className="ds-btn ds-btn-primary"
          onClick={() => (replaceDrafts ? setConfirmOpen(true) : onApply())}
          disabled={
            !canApply ||
            pending ||
            !dryRunResult ||
            !wouldMutate ||
            blocked ||
            !presentation.fixedDishBankStatus.meetsMinimums
          }
          data-testid="generator-apply-btn"
        >
          Bruk denne ukemenyen
        </button>
      </div>

      {confirmOpen ? (
        <div className="lp-gen-apply-confirm" role="dialog" aria-modal="true" data-testid="generator-apply-confirm">
          <p className="ds-body">
            Erstatt kun utkast — eksisterende utkast for varmrett oppdateres. Publiserte dager berøres ikke.
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

      {applyResult?.ok && applyResult.mode === "apply" ? (
        <p className="ds-body" role="status" data-testid="generator-apply-success">
          Utkast lagret. Gå til ukeplanleggeren for å publisere når du er klar.
        </p>
      ) : null}

      {dryRunResult ? (
        <section className="lp-gen-apply-diff" data-testid="generator-apply-diff">
          <h4 className="ds-h4">Diff-sammendrag</h4>
          <ul className="ds-list lp-gen-apply-summary">
            <li>Opprettes: {dryRunResult.summary.createdDraftDays}</li>
            <li>Oppdateres: {dryRunResult.summary.updatedDraftDays}</li>
            <li>Hoppes over: {dryRunResult.summary.skippedExistingDays + dryRunResult.summary.skippedPublishedDays}</li>
            <li>Uendret: {dryRunResult.summary.unchangedDays}</li>
            <li>Blokkert: {dryRunResult.summary.blockedPublishedDays + dryRunResult.summary.failedDays}</li>
          </ul>

          {dryRunResult.blockedReasons.length ? (
            <div className="lp-gen-apply-warnings" role="alert">
              {dryRunResult.blockedReasons.map((r) => (
                <p key={r}>{r}</p>
              ))}
            </div>
          ) : null}

          <ul className="lp-gen-apply-days">
            {dryRunResult.days.map((day) => (
              <li key={day.date} className="lp-gen-apply-day">
                <div className="lp-gen-apply-day-head">
                  <strong>
                    {day.weekday} · {day.date}
                  </strong>
                  <span className={`lp-gen-apply-badge ${statusBadgeClass(day.status)}`}>{day.providerLabel}</span>
                </div>
                {day.generatedState ? (
                  <p className="ds-body ds-muted">
                    {day.generatedState.mealTitle} — {day.generatedState.description.slice(0, 120)}
                  </p>
                ) : null}
                {day.diff.length ? (
                  <ul className="ds-list ds-muted">
                    {day.diff.map((d) => (
                      <li key={d.field}>
                        {d.field}: «{d.before || "—"}» → «{d.after}»
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
