// app/admin/dagens-levering/page.tsx
export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Link from "next/link";

import {
  loadAdminContext,
  isAdminContextBlocked,
  type AdminContextBlocked,
} from "@/lib/admin/loadAdminContext";
import { formatDateNO } from "@/lib/date/format";
import { osloTodayISODate } from "@/lib/date/oslo";
import { loadCompanyOperativeDayRoster } from "@/lib/server/admin/loadCompanyOperativeDayRoster";

import BlockedState from "@/components/admin/BlockedState";
import SupportReportButton from "@/components/admin/SupportReportButton";
import AdminPageShell from "@/components/admin/AdminPageShell";

function blockedTitle(ctx: AdminContextBlocked) {
  if (ctx.blocked === "ACCOUNT_DISABLED") return "Konto er deaktivert";
  if (ctx.blocked === "MISSING_COMPANY_ID") return "Mangler firmatilknytning";
  if (ctx.blocked === "COMPANY_INACTIVE") return "Firma er ikke aktivt";
  return "Systemfeil";
}

function blockedBody(ctx: AdminContextBlocked) {
  if (ctx.blocked === "ACCOUNT_DISABLED") return "Kontoen er deaktivert og har ikke tilgang til administrasjon.";
  if (ctx.blocked === "MISSING_COMPANY_ID") return "Kontoen er registrert som company_admin, men mangler company_id.";
  if (ctx.blocked === "COMPANY_INACTIVE") return "Tilgang er begrenset fordi firma ikke er aktivt.";
  return "Vi klarte ikke å hente nødvendig kontekst akkurat nå.";
}

function blockedLevel(ctx: AdminContextBlocked): "followup" | "critical" {
  return ctx.blocked === "COUNTS_FAILED" ? "critical" : "followup";
}

export default async function DagensLeveringPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string | string[] | null }> | { date?: string | string[] | null };
}) {
  const ctx = await loadAdminContext({
    nextPath: "/admin/dagens-levering",
    enforceCompanyAdmin: true,
    returnBlockedState: true,
  });

  if (isAdminContextBlocked(ctx)) {
    return (
      <div className="lp-container py-8">
        <BlockedState
          level={blockedLevel(ctx)}
          title={blockedTitle(ctx)}
          body={blockedBody(ctx)}
          nextSteps={ctx.nextSteps}
          action={
            <SupportReportButton
              reason={ctx.support.reason}
              companyId={ctx.support.companyId}
              locationId={ctx.support.locationId}
              buttonLabel="Send systemrapport"
              buttonClassName="lp-btn lp-btn--secondary"
            />
          }
          meta={[
            { label: "auth.user.id", value: ctx.dbg.authUserId },
            { label: "auth.user.email", value: ctx.dbg.authEmail || "-" },
            { label: "company_id", value: ctx.companyId ?? "-" },
          ]}
        />
      </div>
    );
  }

  const sp = (await Promise.resolve(searchParams ?? {})) as { date?: string | string[] | null };
  const raw = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const dateISO = raw && /^\d{4}-\d{2}-\d{2}$/.test(String(raw).trim()) ? String(raw).trim() : osloTodayISODate();

  const roster = await loadCompanyOperativeDayRoster({
    companyId: ctx.companyId,
    locationId: ctx.profile?.location_id ?? null,
    companyStatusUpper: String(ctx.company?.status ?? "ACTIVE").toUpperCase(),
    dateISO,
  });

  const s = roster.delivery_summary;

  return (
    <AdminPageShell
      title="Dagens levering (lokasjon og slot)"
      subtitle={`Kun lesing for ${formatDateNO(roster.date_iso)} — eget firma. Samme operative ordregrunnlag som kjøkken.`}
      actions={null}
    >
      <form className="mb-6 flex flex-wrap items-end gap-2" method="get" action="/admin/dagens-levering">
        <label className="text-xs font-semibold text-neutral-600">
          Dato
          <input
            type="date"
            name="date"
            defaultValue={roster.date_iso}
            className="mt-1 block h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
          />
        </label>
        <button type="submit" className="lp-btn lp-btn--secondary h-10">
          Vis
        </button>
      </form>

      {!roster.load_ok ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-950">
          {roster.load_error_message ?? "Kunne ikke laste ordregrunnlag."}
        </div>
      ) : null}

      <div className="mb-4 rounded-2xl border border-black/5 bg-neutral-50/90 p-4 text-sm text-neutral-800">
        <span className="font-semibold">Forklaring</span>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {roster.context_lines_nb.map((line, i) => (
            <li key={`c-${i}`}>{line}</li>
          ))}
        </ul>
      </div>

      {s ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-black/5 bg-white/90 p-4 ring-1 ring-black/5">
            <div className="text-xs font-semibold uppercase text-neutral-600">Operative ordre</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{s.totals.operative_orders}</div>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white/90 p-4 ring-1 ring-black/5">
            <div className="text-xs font-semibold uppercase text-neutral-600">Lokasjoner med ordre</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{s.totals.locations_with_orders}</div>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white/90 p-4 ring-1 ring-black/5">
            <div className="text-xs font-semibold uppercase text-neutral-600">Slots med ordre</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{s.totals.slots_with_orders}</div>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white/90 p-4 ring-1 ring-black/5">
            <div className="text-xs font-semibold uppercase text-neutral-600">Ansatte i grunnlag</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{s.totals.distinct_employees}</div>
          </div>
        </div>
      ) : null}

      {s && s.per_location_slot.length > 0 ? (
        <div className="mb-8 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">Lokasjon × slot</h2>
          <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white/90">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-black/10 bg-neutral-50/90 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <tr>
                  <th className="px-4 py-3">Lokasjon</th>
                  <th className="px-4 py-3">Slot</th>
                  <th className="px-4 py-3">Ordre</th>
                  <th className="px-4 py-3">Ansatte</th>
                  <th className="px-4 py-3">Notat ordre</th>
                  <th className="px-4 py-3">Notat dagvalg</th>
                </tr>
              </thead>
              <tbody>
                {s.per_location_slot.map((r) => (
                  <tr key={`${r.location_id}-${r.slot_norm}`} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium">{r.location_label}</span>
                      <div className="font-mono text-[11px] text-neutral-500">{r.location_id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.slot_norm}</td>
                    <td className="px-4 py-3 tabular-nums">{r.operative_orders}</td>
                    <td className="px-4 py-3 tabular-nums">{r.distinct_employees}</td>
                    <td className="px-4 py-3 tabular-nums">{r.rows_with_order_note}</td>
                    <td className="px-4 py-3 tabular-nums">{r.rows_with_day_choice_note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : roster.load_ok && s && s.per_location_slot.length === 0 ? (
        <p className="mb-8 text-sm text-neutral-600">Ingen operative ordre — ingen lokasjon/slot-rader.</p>
      ) : null}

      {s && s.by_location.length > 0 ? (
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-neutral-900">Per lokasjon</h2>
            <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white/90">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-black/10 bg-neutral-50/90 text-xs font-semibold uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-2">Lokasjon</th>
                    <th className="px-3 py-2">Ordre</th>
                    <th className="px-3 py-2">Ansatte</th>
                    <th className="px-3 py-2">Slots</th>
                  </tr>
                </thead>
                <tbody>
                  {s.by_location.map((r) => (
                    <tr key={r.location_id} className="border-b border-black/5 last:border-0">
                      <td className="px-3 py-2 font-medium">{r.location_label}</td>
                      <td className="px-3 py-2 tabular-nums">{r.operative_orders}</td>
                      <td className="px-3 py-2 tabular-nums">{r.distinct_employees}</td>
                      <td className="px-3 py-2 tabular-nums">{r.slots_with_orders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-neutral-900">Per slot</h2>
            <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white/90">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-black/10 bg-neutral-50/90 text-xs font-semibold uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-2">Slot</th>
                    <th className="px-3 py-2">Ordre</th>
                    <th className="px-3 py-2">Ansatte</th>
                    <th className="px-3 py-2">Lokasjoner</th>
                  </tr>
                </thead>
                <tbody>
                  {s.by_slot.map((r) => (
                    <tr key={r.slot_norm} className="border-b border-black/5 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{r.slot_norm}</td>
                      <td className="px-3 py-2 tabular-nums">{r.operative_orders}</td>
                      <td className="px-3 py-2 tabular-nums">{r.distinct_employees}</td>
                      <td className="px-3 py-2 tabular-nums">{r.locations_with_orders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/admin/orders" className="lp-btn lp-btn--secondary lp-neon-focus">
          Ordrehistorikk
        </Link>
        <Link href="/week" className="lp-btn lp-btn--secondary lp-neon-focus">
          Ukeplan (/week)
        </Link>
        <Link href="/admin/dagens-brukere" className="lp-btn lp-btn--secondary lp-neon-focus">
          Dagens brukere
        </Link>
        <Link href="/admin#firma-operativt" className="lp-btn lp-btn--secondary lp-neon-focus">
          Firmadagens drift
        </Link>
        <Link href="/admin/leveringsgrunnlag" className="lp-btn lp-btn--secondary lp-neon-focus">
          Leveringsgrunnlag
        </Link>
      </div>
    </AdminPageShell>
  );
}
