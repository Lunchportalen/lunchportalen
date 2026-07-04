"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  SuperadminBadge,
  SuperadminHero,
  SuperadminPageShell,
  SuperadminReadOnlyNotice,
  SuperadminSection,
  SuperadminStatusRail,
  SuperadminTableSurface,
} from "@/components/superadmin/shell/SuperadminShell";
import type {
  SuperadminMenuProfileOverviewData,
  SuperadminMenuProfileProviderDetail,
} from "@/lib/server/superadmin/loadSuperadminMenuProfileOverview";

type Props = {
  data: SuperadminMenuProfileOverviewData;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("nb-NO", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function readinessTone(readiness: string): "go" | "watch" | "stop" | "muted" {
  if (readiness === "ok") return "go";
  if (readiness === "warning") return "watch";
  if (readiness === "error") return "stop";
  return "muted";
}

function readinessLabel(readiness: string): string {
  if (readiness === "ok") return "OK";
  if (readiness === "warning") return "Advarsel";
  if (readiness === "error") return "Feil";
  if (readiness === "legacy") return "Legacy";
  return readiness;
}

export default function SuperadminMenuProfilesClient({ data }: Props) {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SuperadminMenuProfileProviderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const selectedRow = useMemo(
    () => data.providers.find((row) => row.providerId === selectedProviderId) ?? null,
    [data.providers, selectedProviderId],
  );

  async function openProviderHealth(providerId: string) {
    setSelectedProviderId(providerId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/superadmin/menu-profiles/${encodeURIComponent(providerId)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        data?: SuperadminMenuProfileProviderDetail;
      };
      if (!res.ok || json.ok === false || !json.data) {
        setDetailError(json.message ?? "Kunne ikke hente profilhelse.");
        return;
      }
      setDetail(json.data);
    } catch {
      setDetailError("Kunne ikke hente profilhelse.");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <SuperadminPageShell fullWidth>
      <SuperadminHero
        variant="command"
        eyebrow="SUPERSMART"
        title="Menyprofil-kontroll"
        lead="Read-only oversikt over resolver, profilhelse og siste generering per leverandør. Ingen flaggendring eller automatisk utrulling fra denne siden."
        meta={
          <>
            <SuperadminBadge tone={data.resolverFlagOn ? "live" : "muted"}>
              Resolver {data.resolverFlagOn ? "ON" : "OFF"}
            </SuperadminBadge>
            <span className="text-xs opacity-70">
              Sjekket: <time dateTime={data.checkedAt}>{formatWhen(data.checkedAt)}</time>
            </span>
          </>
        }
      />

      <SuperadminReadOnlyNotice
        title="Enterprise control layer"
        body="Denne visningen endrer ikke ordre, ordreskrivebane, produksjonsflagg eller katalog. Kun observasjon og sporbarhet."
      />

      <SuperadminStatusRail
        ariaLabel="Menyprofil KPI"
        items={[
          { label: "Leverandører", value: data.totals.providers, numeric: true },
          { label: "Profil OK", value: data.totals.resolvedOk, numeric: true },
          { label: "Generering aktiv", value: data.totals.generationEnabled, numeric: true },
          { label: "Advarsler", value: data.totals.warnings, numeric: true },
        ]}
      />

      <SuperadminSection
        title="Menyprofil-register (9 profiler)"
        lead="Alle SUPERSMART-profiler med varmrettbank og kategoridekning."
        bodyVariant="inset"
      >
        <SuperadminTableSurface>
          <div className="sa-table-surface__pad overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Profil</th>
                  <th className="px-4 py-3">Marked</th>
                  <th className="px-4 py-3">Locale</th>
                  <th className="px-4 py-3">Varmrettbank</th>
                  <th className="px-4 py-3">Kategorietiketter</th>
                </tr>
              </thead>
              <tbody>
                {data.registry.map((profile) => (
                  <tr key={profile.profileId} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{profile.profileName}</div>
                      <div className="text-xs text-neutral-500">{profile.profileId}</div>
                    </td>
                    <td className="px-4 py-3">{profile.market}</td>
                    <td className="px-4 py-3">{profile.locale}</td>
                    <td className="px-4 py-3">{profile.warmDishBankCount}</td>
                    <td className="px-4 py-3">
                      {profile.categoryLabelCoverage.covered}/{profile.categoryLabelCoverage.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SuperadminTableSurface>
      </SuperadminSection>

      <SuperadminSection
        title="Leverandører"
        lead="Locale, profil, resolver og siste generering. Klikk en rad for detaljert profilhelse."
        bodyVariant="default"
        flat
      >
        <SuperadminTableSurface>
          <div className="sa-table-surface__pad overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Leverandør</th>
                  <th className="px-4 py-3">Locale</th>
                  <th className="px-4 py-3">Profil</th>
                  <th className="px-4 py-3">Land</th>
                  <th className="px-4 py-3">Valuta</th>
                  <th className="px-4 py-3">Resolver</th>
                  <th className="px-4 py-3">Profil</th>
                  <th className="px-4 py-3">Generering</th>
                  <th className="px-4 py-3">Siste generering</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.providers.map((row) => (
                  <tr
                    key={row.providerId}
                    className={`border-b last:border-0 ${selectedProviderId === row.providerId ? "bg-neutral-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left font-medium underline-offset-2 hover:underline"
                        onClick={() => void openProviderHealth(row.providerId)}
                      >
                        {row.providerName}
                      </button>
                    </td>
                    <td className="px-4 py-3">{row.locale ?? "—"}</td>
                    <td className="px-4 py-3 break-all">{row.menuProfileId ?? "—"}</td>
                    <td className="px-4 py-3">{row.country ?? "—"}</td>
                    <td className="px-4 py-3">{row.currency ?? "—"}</td>
                    <td className="px-4 py-3">{row.resolverStatus}</td>
                    <td className="px-4 py-3">{row.profileResolved}</td>
                    <td className="px-4 py-3">{row.generationEnabled ? "JA" : "NEI"}</td>
                    <td className="px-4 py-3">
                      <div>{formatWhen(row.lastGenerationAt)}</div>
                      {row.lastGenerationSummary ? (
                        <div className="text-xs text-neutral-500">{row.lastGenerationSummary}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <SuperadminBadge tone={readinessTone(row.readiness)}>
                          {readinessLabel(row.readiness)}
                        </SuperadminBadge>
                        {row.mismatch ? (
                          <span className="text-xs text-amber-700">Locale/profil mismatch</span>
                        ) : null}
                        {row.warning ? (
                          <span className="text-xs text-amber-700 break-all">{row.warning}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SuperadminTableSurface>
      </SuperadminSection>

      {selectedRow ? (
        <SuperadminSection
          title={`Profilhelse — ${selectedRow.providerName}`}
          lead="Resolver, fallback, bank og kategoridekning for valgt leverandør."
          action={
            <Link href={`/superadmin/pilot-control?providerId=${encodeURIComponent(selectedRow.providerId)}`} className="text-xs underline">
              Åpne pilotkontroll
            </Link>
          }
          bodyVariant="proof"
        >
          {detailLoading ? <p className="text-sm text-neutral-600">Laster profilhelse …</p> : null}
          {detailError ? <p className="text-sm text-red-700">{detailError}</p> : null}
          {detail ? (
            <div className="grid gap-4 md:grid-cols-2">
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-xs uppercase text-neutral-500">Profil løst</dt>
                  <dd>{detail.health.profileResolved}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-neutral-500">Fallback aktiv</dt>
                  <dd>{detail.health.fallbackActive ? "JA" : "NEI"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-neutral-500">Varmrettbank</dt>
                  <dd>{detail.health.warmDishBankCount}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-neutral-500">Kategorietiketter</dt>
                  <dd>
                    {detail.health.categoryLabelCoverage.covered}/{detail.health.categoryLabelCoverage.total}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-neutral-500">Generering aktiv</dt>
                  <dd>{detail.health.generationEnabled ? "JA" : "NEI"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-neutral-500">Kilde</dt>
                  <dd>{detail.health.resolveSource ?? "—"}</dd>
                </div>
              </dl>
              <div className="text-sm">
                {detail.health.localeProfileMismatch ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    Mismatch: {detail.health.mismatchDetail ?? "Locale og menyprofil stemmer ikke."}
                  </p>
                ) : null}
                {detail.health.warning ? (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    {detail.health.warning}
                  </p>
                ) : null}
                {detail.health.generationReason ? (
                  <p className="mt-2 text-neutral-600">Generering: {detail.health.generationReason}</p>
                ) : null}
                <p className="mt-2 text-neutral-600">
                  Siste generering: {formatWhen(detail.health.lastGenerationAt)}
                  {detail.health.lastGenerationSummary ? ` · ${detail.health.lastGenerationSummary}` : ""}
                </p>
              </div>
            </div>
          ) : null}
        </SuperadminSection>
      ) : null}
    </SuperadminPageShell>
  );
}
