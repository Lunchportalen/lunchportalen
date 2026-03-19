"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

type ExperimentDetail = {
  id: string;
  page_id: string;
  variant_id: string | null;
  name: string;
  type: string;
  status: string;
  experiment_id: string;
  config: { variants?: Array<{ key: string; label: string }> };
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  stats?: {
    views: number;
    clicks: number;
    conversions: number;
    variants: string[];
    byVariant: Array<{ variant: string; views: number; clicks: number; conversions: number }>;
  };
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Kladd" },
  { value: "active", label: "Aktiv" },
  { value: "paused", label: "Pauset" },
  { value: "completed", label: "Fullført" },
];
const TYPE_LABEL: Record<string, string> = {
  headline: "Overskrift",
  cta: "CTA",
  hero_body: "Hero/tekst",
};

export default function ExperimentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";
  const [detail, setDetail] = useState<ExperimentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backoffice/experiments/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (res.status === 404) setDetail(null);
        throw new Error(res.status === 404 ? "Ikke funnet" : `Feil ${res.status}`);
      }
      const data = await res.json();
      const d = data?.data ?? data;
      setDetail(d);
      setSelectedStatus(d.status ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste eksperiment");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleStatusChange = async (newStatus: string) => {
    if (!id || newStatus === detail?.status) return;
    setStatusUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/backoffice/experiments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Feil ${res.status}`);
      }
      setSelectedStatus(newStatus);
      fetchDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke oppdatere status");
    } finally {
      setStatusUpdating(false);
    }
  };

  if (!id) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <p className="text-sm text-[rgb(var(--lp-muted))]">Mangler eksperiment-id.</p>
        <Link href="/backoffice/experiments" className="mt-2 text-sm text-[rgb(var(--lp-ring))] hover:underline">
          Tilbake til liste
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--lp-muted))]">
          <Icon name="loading" size="sm" className="animate-spin" />
          Laster…
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{error}</div>
        <Link href="/backoffice/experiments" className="mt-4 text-sm text-[rgb(var(--lp-ring))] hover:underline">
          Tilbake til liste
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <p className="text-sm text-[rgb(var(--lp-muted))]">Eksperiment ikke funnet.</p>
        <Link href="/backoffice/experiments" className="mt-2 text-sm text-[rgb(var(--lp-ring))] hover:underline">
          Tilbake til liste
        </Link>
      </div>
    );
  }

  const stats = detail.stats;
  const variants = detail.config?.variants ?? [];

  return (
    <div className="flex h-full flex-col overflow-auto bg-white p-6">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/backoffice/experiments" className="text-sm text-[rgb(var(--lp-muted))] hover:underline">
          ← Eksperimenter
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--lp-text))]">{detail.name}</h1>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            {TYPE_LABEL[detail.type] ?? detail.type} · experiment_id: <code className="rounded bg-slate-100 px-1 font-mono text-xs">{detail.experiment_id}</code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => void handleStatusChange(e.target.value)}
              disabled={statusUpdating}
              className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-1.5 text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {statusUpdating ? <Icon name="loading" size="sm" className="animate-spin text-[rgb(var(--lp-muted))]" /> : null}
        </div>
      </div>
      {error ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{error}</div>
      ) : null}

      <section className="mb-6 rounded-xl border border-[rgb(var(--lp-border))] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[rgb(var(--lp-text))]">Eierskap og sporbarhet</h2>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-[rgb(var(--lp-muted))]">Opprettet</dt>
            <dd className="text-[rgb(var(--lp-text))]">
              {new Date(detail.created_at).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}
              {detail.created_by ? ` av ${detail.created_by}` : ""}
            </dd>
          </div>
          {detail.updated_at ? (
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Sist oppdatert</dt>
              <dd className="text-[rgb(var(--lp-text))]">
                {new Date(detail.updated_at).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}
              </dd>
            </div>
          ) : null}
          {detail.started_at ? (
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Startet</dt>
              <dd className="text-[rgb(var(--lp-text))]">
                {new Date(detail.started_at).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}
              </dd>
            </div>
          ) : null}
          {detail.completed_at ? (
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Fullført</dt>
              <dd className="text-[rgb(var(--lp-text))]">
                {new Date(detail.completed_at).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[rgb(var(--lp-muted))]">Side (page_id)</dt>
            <dd className="font-mono text-xs text-[rgb(var(--lp-text))]">{detail.page_id}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-6 rounded-xl border border-[rgb(var(--lp-border))] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[rgb(var(--lp-text))]">Resultater (fra analytics)</h2>
        {stats ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="rounded border border-[rgb(var(--lp-border))] bg-slate-50 px-3 py-1.5">
                Visninger: <strong>{stats.views}</strong>
              </span>
              <span className="rounded border border-[rgb(var(--lp-border))] bg-slate-50 px-3 py-1.5">
                Klikk: <strong>{stats.clicks}</strong>
              </span>
              <span className="rounded border border-[rgb(var(--lp-border))] bg-slate-50 px-3 py-1.5">
                Konverteringer: <strong>{stats.conversions}</strong>
              </span>
            </div>
            {stats.byVariant && stats.byVariant.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[rgb(var(--lp-border))]">
                      <th className="py-2 pr-4 font-medium text-[rgb(var(--lp-text))]">Variant</th>
                      <th className="py-2 pr-4 font-medium text-[rgb(var(--lp-text))]">Visninger</th>
                      <th className="py-2 pr-4 font-medium text-[rgb(var(--lp-text))]">Klikk</th>
                      <th className="py-2 pr-4 font-medium text-[rgb(var(--lp-text))]">Konverteringer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byVariant.map((v) => (
                      <tr key={v.variant} className="border-b border-[rgb(var(--lp-border))]/60">
                        <td className="py-2 pr-4 font-medium">{v.variant}</td>
                        <td className="py-2 pr-4">{v.views}</td>
                        <td className="py-2 pr-4">{v.clicks}</td>
                        <td className="py-2 pr-4">{v.conversions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Data kommer fra experiment_results. Send view/click/conversion til /api/backoffice/experiments/event med samme experiment_id for å oppdatere.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen resultatdata ennå. Kjør trafikk med eksperiment_id for å se tall her.</p>
        )}
      </section>

      <section className="rounded-xl border border-[rgb(var(--lp-border))] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[rgb(var(--lp-text))]">Varianter</h2>
        {variants.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {variants.map((v) => (
              <li key={v.key} className="flex items-center gap-2">
                <Icon name="success" size="sm" className="text-green-600" />
                <span className="font-medium">{v.label}</span>
                <span className="text-[rgb(var(--lp-muted))]">({v.key})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen varianter konfigurert. Rediger eksperimentet for å legge til kopi per variant.</p>
        )}
      </section>
    </div>
  );
}
