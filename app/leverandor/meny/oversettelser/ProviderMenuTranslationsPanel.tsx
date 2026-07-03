"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { APP_LOCALES } from "@/lib/i18n/localeRegistry";
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

const STATUS_LABELS: Record<string, string> = {
  missing: "Mangler",
  draft: "Utkast",
  suggested: "Forslag",
  approved: "Godkjent",
  rejected: "Avvist",
  stale: "Utdatert",
};

export default function ProviderMenuTranslationsPanel({ canWrite }: Props) {
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
        throw new Error(json.message ?? "Kunne ikke hente oversettelser.");
      }
      setRows(Array.isArray(json.data?.translations) ? json.data.translations : []);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

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
        throw new Error(json.message ?? "Kunne ikke oppdatere oversettelse.");
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
        throw new Error(json.message ?? "Kunne ikke opprette oversettelse.");
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
        <p className="ds-body">
          Kun godkjente oversettelser vises til ansatte. Utkast, forslag og avviste rader vises aldri
          til ansatte.
        </p>
        <p className="ds-body ds-muted">
          Delvis dekning er normalt. Mangler eller utdatert hash faller tilbake til leverandørens
          originaltekst — dette endrer ikke bestillingsnøkler, pakke eller pris for ansatte.
        </p>
        <p className="ds-body ds-muted">
          Kilde-referanser: måltid = <code>item.key</code>, kategori = kategori-slug (f.eks. paasmurt,
          salat), allergen = normalisert token.
        </p>
        <p className="ds-body ds-muted">
          Kilder hentes fra katalog og aktivt menyvindu (publiserte menuDay-rader). Varmrett/menu_day-kilder
          vises når de finnes i aktivt menyvindu.
        </p>
      </section>

      <section className="ds-card ds-section">
        <h2 className="ds-h3">Dekning per språk</h2>
        {sourcesLoading ? <p className="ds-body">Laster kilder…</p> : null}
        {!sourcesLoading && sourcesReport?.coverage?.locales?.length ? (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Språk</th>
                  <th>Dekning</th>
                  <th>Godkjent synlig</th>
                  <th>Mangler</th>
                  <th>Utkast</th>
                  <th>Utdatert</th>
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
          <p className="ds-body">Ingen kilder funnet i katalogen ennå.</p>
        ) : null}
      </section>

      {!sourcesLoading &&
      sourcesReport &&
      (sourcesReport.missingCandidates.length > 0 || sourcesReport.staleCandidates.length > 0) ? (
        <section className="ds-card ds-section">
          <h2 className="ds-h3">Kilder uten godkjent oversettelse</h2>
          {sourcesReport.missingCandidates.length > 0 ? (
            <>
              <p className="ds-body ds-muted">
                {sourcesReport.missingCandidates.length} kilder mangler rad på minst ett mål-språk.
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
                          Opprett utkast
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
              {sourcesReport.staleCandidates.length} kilder har hash-avvik — ansatte ser originaltekst
              til raden er godkjent på nytt.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="ds-card ds-section">
        <div className="ds-provider-translations-filters">
          <label className="ds-field">
            <span className="ds-label">Språk</span>
            <select
              className="ds-input"
              value={filterLocale}
              onChange={(e) => setFilterLocale(e.target.value)}
            >
              <option value="">Alle</option>
              {APP_LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </select>
          </label>
          <label className="ds-field">
            <span className="ds-label">Status</span>
            <select
              className="ds-input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Alle</option>
              {MENU_CONTENT_TRANSLATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status] ?? status}
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
          <h2 className="ds-h3">Ny oversettelsesrad</h2>
          <p className="ds-body ds-muted">
            Opprett manuell rad med kilde-referanse og originaltekst, eller bruk «Opprett utkast» fra
            kildelisten over.
          </p>
          <div className="ds-provider-translations-create-grid">
            <label className="ds-field">
              <span className="ds-label">Kilde</span>
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
              <span className="ds-label">Felt</span>
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
              <span className="ds-label">Språk</span>
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
              <span className="ds-label">Kilde-referanse</span>
              <input
                className="ds-input"
                value={createForm.sourceRef}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, sourceRef: e.target.value }))}
                placeholder="item.key, kategori-slug eller allergen-token"
              />
            </label>
            <label className="ds-field ds-field-span-2">
              <span className="ds-label">Originaltekst</span>
              <textarea
                className="ds-input"
                rows={2}
                value={createForm.originalText}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, originalText: e.target.value }))}
              />
            </label>
            <label className="ds-field ds-field-span-2">
              <span className="ds-label">Oversatt tekst (valgfritt)</span>
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
            Lagre utkast
          </button>
        </section>
      ) : null}

      <section className="ds-card ds-section">
        <h2 className="ds-h3">Oversettelser</h2>
        {loading ? <p className="ds-body">Laster…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="ds-body">
            Ingen oversettelsesrader ennå. Opprett en rad manuelt, eller vent til import fra menykilder
            er tilgjengelig.
          </p>
        ) : null}
        {!loading && rows.length > 0 ? (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Kilde</th>
                  <th>Felt</th>
                  <th>Språk</th>
                  <th>Original</th>
                  <th>Oversatt</th>
                  <th>Status</th>
                  <th>Oppdatert</th>
                  {canWrite ? <th>Handling</th> : null}
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
                          row.translatedText ?? "—"
                        )}
                      </td>
                      <td>
                        {STATUS_LABELS[row.status] ?? row.status}
                        {!row.hashMatches ? (
                          <div className="ds-muted">Hash avviker — marker utdatert ved behov</div>
                        ) : null}
                      </td>
                      <td>{new Date(row.updatedAt).toLocaleString("nb-NO")}</td>
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
                            Lagre utkast
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
                            Godkjenn
                          </button>
                          <button
                            type="button"
                            className="ds-btn"
                            disabled={busyId === row.id}
                            onClick={() => void patchRow(row.id, { action: "reject" })}
                          >
                            Avvis
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
