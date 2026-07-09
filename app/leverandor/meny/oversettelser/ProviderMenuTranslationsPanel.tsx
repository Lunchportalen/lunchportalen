"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { APP_LOCALES, intlLocaleForAppLocale, type AppLocale } from "@/lib/i18n/localeRegistry";
import {
  MENU_CONTENT_FIELDS,
  MENU_CONTENT_SOURCE_KINDS,
  MENU_CONTENT_TRANSLATION_STATUSES,
} from "@/lib/smart-menu/translationStatusConstants";

type TranslationRow = {
  id: string;
  sourceKind: string;
  sourceRef: string;
  field: string;
  locale: string;
  originalText: string;
  originalTextHash: string;
  translatedText: string | null;
  status: string;
  approvedAt: string | null;
  updatedAt: string;
  hashMatches: boolean;
  employeeVisible: false;
};

type LocaleCoverageSummary = {
  locale: string;
  totalCandidates: number;
  employeeVisible: number;
  missing: number;
  draft: number;
  suggested: number;
  rejected: number;
  stale: number;
  blankTranslated: number;
  coveragePercent: number;
};

type SourceCandidate = {
  source_kind: string;
  source_ref: string;
  field: string;
  original_text: string;
  original_text_hash: string;
};

type SourcesReport = {
  candidateCount: number;
  coverage: {
    totalCandidates: number;
    locales: LocaleCoverageSummary[];
    staleCount: number;
    missingCount: number;
  };
  missingCandidates: SourceCandidate[];
  staleCandidates: SourceCandidate[];
};

type Props = {
  canWrite: boolean;
};

export default function ProviderMenuTranslationsPanel({ canWrite }: Props) {
  const t = useTranslations("provider.menu.translations");
  const uiLocale = useLocale() as AppLocale;
  const dateLocale = intlLocaleForAppLocale(uiLocale);

  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [sourcesReport, setSourcesReport] = useState<SourcesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterLocale, setFilterLocale] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState({
    sourceKind: "menu_day_item",
    sourceRef: "",
    field: "title",
    locale: "en",
    originalText: "",
    translatedText: "",
  });

  const statusLabels = useMemo(
    () =>
      Object.fromEntries(
        MENU_CONTENT_TRANSLATION_STATUSES.map((status) => [status, t(`status.${status}`)]),
      ) as Record<string, string>,
    [t],
  );

  function statusLabel(status: string): string {
    return statusLabels[status] ?? status;
  }

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filterLocale) params.set("locale", filterLocale);
    if (filterStatus) params.set("status", filterStatus);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [filterLocale, filterStatus]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/provider/menu-translations${query}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? t("errors.loadFailed"));
      }
      setRows(Array.isArray(json.data?.translations) ? json.data.translations : []);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [query, t]);

  const loadSources = useCallback(async () => {
    setSourcesLoading(true);
    try {
      const res = await fetch("/api/provider/menu-translations/sources", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSourcesReport(null);
        return;
      }
      setSourcesReport(json.data ?? null);
    } catch {
      setSourcesReport(null);
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  function createRowFromCandidate(candidate: SourceCandidate) {
    setCreateForm({
      sourceKind: candidate.source_kind,
      sourceRef: candidate.source_ref,
      field: candidate.field,
      locale: "en",
      originalText: candidate.original_text,
      translatedText: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function patchRow(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/provider/menu-translations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? t("errors.updateFailed"));
      }
      await loadRows();
      await loadSources();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusyId(null);
    }
  }

  async function createRow() {
    setBusyId("create");
    setError(null);
    try {
      const res = await fetch("/api/provider/menu-translations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceKind: createForm.sourceKind,
          sourceRef: createForm.sourceRef,
          field: createForm.field,
          locale: createForm.locale,
          originalText: createForm.originalText,
          translatedText: createForm.translatedText || null,
          status: "draft",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? t("errors.createFailed"));
      }
      setCreateForm((prev) => ({ ...prev, sourceRef: "", originalText: "", translatedText: "" }));
      await loadRows();
      await loadSources();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="ds-provider-translations">
      <section className="ds-card ds-section">
        <p className="ds-body">{t("introApproved")}</p>
        <p className="ds-body ds-muted">{t("introPartialCoverage")}</p>
        <p className="ds-body ds-muted">{t("introSourceRefs")}</p>
        <p className="ds-body ds-muted">{t("introSources")}</p>
      </section>

      <section className="ds-card ds-section">
        <h2 className="ds-h3">{t("coverageTitle")}</h2>
        {sourcesLoading ? <p className="ds-body">{t("loadingSources")}</p> : null}
        {!sourcesLoading && sourcesReport?.coverage?.locales?.length ? (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>{t("coverageTable.locale")}</th>
                  <th>{t("coverageTable.coverage")}</th>
                  <th>{t("coverageTable.employeeVisible")}</th>
                  <th>{t("coverageTable.missing")}</th>
                  <th>{t("coverageTable.draft")}</th>
                  <th>{t("coverageTable.stale")}</th>
                </tr>
              </thead>
              <tbody>
                {sourcesReport.coverage.locales.map((locale) => (
                  <tr key={locale.locale}>
                    <td>{locale.locale}</td>
                    <td>{locale.coveragePercent}%</td>
                    <td>{locale.employeeVisible}</td>
                    <td>{locale.missing}</td>
                    <td>{locale.draft + locale.suggested}</td>
                    <td>{locale.stale + locale.blankTranslated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!sourcesLoading && !sourcesReport?.coverage?.locales?.length ? (
          <p className="ds-body">{t("noSources")}</p>
        ) : null}
      </section>

      {!sourcesLoading &&
      sourcesReport &&
      (sourcesReport.missingCandidates.length > 0 || sourcesReport.staleCandidates.length > 0) ? (
        <section className="ds-card ds-section">
          <h2 className="ds-h3">{t("missingTitle")}</h2>
          {sourcesReport.missingCandidates.length > 0 ? (
            <>
              <p className="ds-body ds-muted">
                {t("missingCount", { count: sourcesReport.missingCandidates.length })}
              </p>
              <ul className="ds-body">
                {sourcesReport.missingCandidates.slice(0, 12).map((candidate) => (
                  <li key={`${candidate.source_kind}:${candidate.source_ref}:${candidate.field}`}>
                    {candidate.source_kind} · {candidate.source_ref} · {candidate.field} —{" "}
                    {candidate.original_text}
                    {canWrite ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="ds-btn ds-btn-link"
                          onClick={() => void createRowFromCandidate(candidate)}
                        >
                          {t("createDraftFromSource")}
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {sourcesReport.staleCandidates.length > 0 ? (
            <p className="ds-body ds-error" role="status">
              {t("staleWarning", { count: sourcesReport.staleCandidates.length })}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="ds-card ds-section">
        <div className="ds-provider-translations-filters">
          <label className="ds-field">
            <span className="ds-label">{t("filters.locale")}</span>
            <select
              className="ds-input"
              value={filterLocale}
              onChange={(e) => setFilterLocale(e.target.value)}
            >
              <option value="">{t("filters.all")}</option>
              {APP_LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </select>
          </label>
          <label className="ds-field">
            <span className="ds-label">{t("filters.status")}</span>
            <select
              className="ds-input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">{t("filters.all")}</option>
              {MENU_CONTENT_TRANSLATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <section className="ds-card ds-section">
          <p className="ds-body ds-error" role="alert">
            {error}
          </p>
        </section>
      ) : null}

      {canWrite ? (
        <section className="ds-card ds-section">
          <h2 className="ds-h3">{t("createTitle")}</h2>
          <p className="ds-body ds-muted">{t("createLead")}</p>
          <div className="ds-provider-translations-create-grid">
            <label className="ds-field">
              <span className="ds-label">{t("form.sourceKind")}</span>
              <select
                className="ds-input"
                value={createForm.sourceKind}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, sourceKind: e.target.value }))}
              >
                {MENU_CONTENT_SOURCE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
            <label className="ds-field">
              <span className="ds-label">{t("form.field")}</span>
              <select
                className="ds-input"
                value={createForm.field}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, field: e.target.value }))}
              >
                {MENU_CONTENT_FIELDS.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </label>
            <label className="ds-field">
              <span className="ds-label">{t("form.locale")}</span>
              <select
                className="ds-input"
                value={createForm.locale}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, locale: e.target.value }))}
              >
                {APP_LOCALES.filter((locale) => locale !== "nb").map((locale) => (
                  <option key={locale} value={locale}>
                    {locale}
                  </option>
                ))}
              </select>
            </label>
            <label className="ds-field ds-field-span-2">
              <span className="ds-label">{t("form.sourceRef")}</span>
              <input
                className="ds-input"
                value={createForm.sourceRef}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, sourceRef: e.target.value }))}
                placeholder={t("form.sourceRefPlaceholder")}
              />
            </label>
            <label className="ds-field ds-field-span-2">
              <span className="ds-label">{t("form.originalText")}</span>
              <textarea
                className="ds-input"
                rows={2}
                value={createForm.originalText}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, originalText: e.target.value }))}
              />
            </label>
            <label className="ds-field ds-field-span-2">
              <span className="ds-label">{t("form.translatedTextOptional")}</span>
              <textarea
                className="ds-input"
                rows={2}
                value={createForm.translatedText}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, translatedText: e.target.value }))}
              />
            </label>
          </div>
          <button
            type="button"
            className="ds-btn ds-btn-primary"
            disabled={busyId !== null}
            onClick={() => void createRow()}
          >
            {t("saveDraft")}
          </button>
        </section>
      ) : null}

      <section className="ds-card ds-section">
        <h2 className="ds-h3">{t("listTitle")}</h2>
        {loading ? <p className="ds-body">{t("loading")}</p> : null}
        {!loading && rows.length === 0 ? <p className="ds-body">{t("emptyList")}</p> : null}
        {!loading && rows.length > 0 ? (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>{t("listTable.source")}</th>
                  <th>{t("listTable.field")}</th>
                  <th>{t("listTable.locale")}</th>
                  <th>{t("listTable.original")}</th>
                  <th>{t("listTable.translated")}</th>
                  <th>{t("listTable.status")}</th>
                  <th>{t("listTable.updated")}</th>
                  {canWrite ? <th>{t("listTable.actions")}</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const editValue = draftEdits[row.id] ?? row.translatedText ?? "";
                  return (
                    <tr key={row.id}>
                      <td>
                        <div>{row.sourceKind}</div>
                        <div className="ds-muted">{row.sourceRef}</div>
                      </td>
                      <td>{row.field}</td>
                      <td>{row.locale}</td>
                      <td>{row.originalText}</td>
                      <td>
                        {canWrite ? (
                          <textarea
                            className="ds-input"
                            rows={2}
                            value={editValue}
                            onChange={(e) =>
                              setDraftEdits((prev) => ({ ...prev, [row.id]: e.target.value }))
                            }
                          />
                        ) : (
                          row.translatedText ?? t("emptyTranslated")
                        )}
                      </td>
                      <td>
                        {statusLabel(row.status)}
                        {!row.hashMatches ? (
                          <div className="ds-muted">{t("hashMismatch")}</div>
                        ) : null}
                      </td>
                      <td>{new Date(row.updatedAt).toLocaleString(dateLocale)}</td>
                      {canWrite ? (
                        <td className="ds-provider-translations-actions">
                          <button
                            type="button"
                            className="ds-btn"
                            disabled={busyId === row.id}
                            onClick={() =>
                              void patchRow(row.id, {
                                action: "save_draft",
                                translatedText: editValue || null,
                              })
                            }
                          >
                            {t("saveDraft")}
                          </button>
                          <button
                            type="button"
                            className="ds-btn ds-btn-primary"
                            disabled={busyId === row.id}
                            onClick={() =>
                              void patchRow(row.id, {
                                action: "approve",
                                translatedText: editValue,
                              })
                            }
                          >
                            {t("approve")}
                          </button>
                          <button
                            type="button"
                            className="ds-btn"
                            disabled={busyId === row.id}
                            onClick={() => void patchRow(row.id, { action: "reject" })}
                          >
                            {t("reject")}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
