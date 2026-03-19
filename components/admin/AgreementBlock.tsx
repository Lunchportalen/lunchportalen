// components/admin/AgreementBlock.tsx
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentAgreementState } from "@/lib/agreement/currentAgreement";
import { osloTodayISODate, OSLO_TZ, addDaysISO } from "@/lib/date/oslo";
import SupportReportButton from "@/components/admin/SupportReportButton";

type AdminCounts = {
  employeesTotal: number;
  employeesActive: number;
  employeesDisabled: number;
};

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";

const DAY_ORDER: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Man" },
  { key: "tue", label: "Tir" },
  { key: "wed", label: "Ons" },
  { key: "thu", label: "Tor" },
  { key: "fri", label: "Fre" },
];

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "Ikke tilgjengelig";
}

function displayCount(v: number | null | undefined) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "Ikke tilgjengelig";
  return String(n);
}

function money(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "Ikke tilgjengelig";
  return `${Math.round(n)} kr`;
}

function statusLabel(v: string | null | undefined) {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  return "MISSING";
}

function statusClass(v: string | null | undefined) {
  const s = statusLabel(v);
  if (s === "ACTIVE") return "bg-emerald-50 text-emerald-900";
  if (s === "PAUSED") return "bg-amber-50 text-amber-900";
  if (s === "CLOSED") return "bg-red-50 text-red-900";
  return "bg-neutral-100 text-neutral-800";
}

function toOsloParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    yyyy: get("year"),
    mm: get("month"),
    dd: get("day"),
    hh: Number(get("hour")),
    mi: Number(get("minute")),
  };
}

function isCancelledBeforeCutoff(orderDateISO: string, updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return false;
  const p = toOsloParts(d);
  const dateLocal = `${p.yyyy}-${p.mm}-${p.dd}`;
  if (dateLocal < orderDateISO) return true;
  if (dateLocal > orderDateISO) return false;
  const minutes = p.hh * 60 + p.mi;
  return minutes < 8 * 60;
}

export default async function AgreementBlock(props: {
  companyId: string;
  counts: AdminCounts;
  locationId?: string | null;
}) {
  const companyId = String(props.companyId ?? "").trim();
  const rid = `admin_agreement_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = supabaseAdmin();

  const agreementState = await getCurrentAgreementState({ rid });
  if (!agreementState.ok) {
    const err = agreementState as { message: string };
    return (
      <div className="lp-glass-card rounded-3xl p-6">
        <div className="text-sm font-semibold text-neutral-900">Kunne ikke hente avtale</div>
        <div className="mt-1 text-sm text-neutral-600">{safeText(err.message)}</div>
      </div>
    );
  }

  if (agreementState.companyId !== companyId) {
    return (
      <div className="lp-glass-card rounded-3xl p-6">
        <div className="text-sm font-semibold text-neutral-900">Avtale er ikke for dette firmaet</div>
        <div className="mt-1 text-sm text-neutral-600">Firmatilknytning stemmer ikke med avtalegrunnlaget.</div>
      </div>
    );
  }

  const agreementMessage =
    agreementState.status === "MISSING"
      ? agreementState.statusReason === "MISSING_DAYMAP"
        ? "Avtalen mangler dagoppsett."
        : agreementState.statusReason === "MISSING_DELIVERY_DAYS"
          ? "Avtalen mangler gyldige leveringsdager."
          : "Ingen aktiv avtale for firma."
      : null;

  const today = osloTodayISODate();
  const from = addDaysISO(today, -6);
  const to = today;

  let cancellationsBefore0800: number | null = null;
  let ordersTodayCount: number | null = null;

  try {
    const { data: orders, error } = await admin
      .from("orders")
      .select("date,status,cancelled_at,updated_at,created_at")
      .eq("company_id", companyId)
      .gte("date", from)
      .lte("date", to);

    if (!error) {
      const cancelled = (orders ?? []).filter((o: any) => String(o.status ?? "").toUpperCase() === "CANCELLED");
      const cancelledBefore = cancelled.filter((o: any) =>
        isCancelledBeforeCutoff(o.date, o.cancelled_at ?? o.updated_at ?? o.created_at)
      );
      cancellationsBefore0800 = cancelledBefore.length;
    }
  } catch {
    cancellationsBefore0800 = null;
  }

  try {
    const { count, error } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("date", today)
      .in("status", ["ACTIVE", "active", "QUEUED", "PACKED", "DELIVERED"]);

    if (!error) ordersTodayCount = Number(count ?? 0);
  } catch {
    ordersTodayCount = null;
  }

  const previewDays = DAY_ORDER.map((d) => {
    const enabled = agreementState.status === "ACTIVE" && agreementState.deliveryDays.includes(d.key);
    const tier = agreementState.dayTiers[d.key] ?? null;
    return { ...d, enabled, tier };
  });

  const mixLabel = `${agreementState.basisDays} dager BASIS · ${agreementState.luxusDays} dager LUXUS`;

  const hasPrice = typeof agreementState.pricePerCuvertNok === "number" && agreementState.pricePerCuvertNok > 0;

  return (
    <section className="lp-card lp-card-pad">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--lp-fg))]">Avtale</h1>
          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Avtalen er låst. Endringer håndteres av superadmin.</div>
        </div>
        <div className="flex items-center gap-4 text-sm text-[rgb(var(--lp-muted))]">
          <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold ${statusClass(agreementState.status)}`}>
            {statusLabel(agreementState.status)}
          </span>
          <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Cut-off 08:00 Europe/Oslo</span>
        </div>
      </div>

      <div className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
        Kilde: company_id {safeText(agreementState.companyId)} · agreement_id {safeText(agreementState.agreementId)} · updated_at{" "}
        {safeText(agreementState.updatedAt)}
      </div>

      {agreementState.status !== "ACTIVE" ? (
        <div className="mt-5 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-4 text-sm text-[rgb(var(--lp-muted))]">
          <div className="text-base font-semibold text-[rgb(var(--lp-fg))]">{agreementMessage ?? "Ingen aktiv avtale."}</div>
          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Avtalen er utilgjengelig. Ansatte kan ikke bestille før aktiv avtale er satt.
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[rgb(var(--lp-muted))]">
        <span className="font-semibold text-[rgb(var(--lp-fg))]">{mixLabel}</span>
      </div>

      <div className="mt-5">
        <div className="text-sm font-semibold text-[rgb(var(--lp-fg))]">Leveringsdager</div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {previewDays.map((d) => {
          const isLuxus = d.tier === "LUXUS";
          return (
            <div
              key={d.key}
              className={[
                "flex min-h-28 flex-col items-center justify-center rounded-[var(--lp-radius)] border px-3 py-4 text-center",
                d.enabled ? "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))]" : "border-[rgb(var(--lp-border))] bg-white/40 text-[rgb(var(--lp-muted))]",
              ].join(" ")}
            >
              <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{d.label}</div>
              <div
                className={[
                  "mt-2 inline-flex min-h-6 items-center justify-center rounded-full px-3 text-xs font-semibold",
                  d.enabled
                    ? isLuxus
                      ? "bg-amber-100 text-amber-900"
                      : "bg-slate-200 text-slate-900"
                    : "bg-neutral-200 text-neutral-500",
                ].join(" ")}
              >
                {d.enabled && d.tier ? d.tier : "Ikke i avtalen"}
              </div>
              {d.enabled && hasPrice ? (
                <div className="mt-2 text-xs font-semibold text-[rgb(var(--lp-fg))]">{money(agreementState.pricePerCuvertNok)}</div>
              ) : null}
            </div>
          );
        })}
        </div>
      </div>

      <div className="mt-7">
        <div className="text-sm font-semibold text-[rgb(var(--lp-fg))]">Dette ser ansatte</div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {previewDays.map((d) => (
            <div
              key={`preview_${d.key}`}
              className={[
                "rounded-[var(--lp-radius)] border px-3 py-3 text-sm",
                d.enabled ? "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))]" : "border-[rgb(var(--lp-border))] bg-white/40 text-[rgb(var(--lp-muted))]",
              ].join(" ")}
            >
              <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{d.label}</div>
              <div className="mt-2 text-sm font-semibold text-[rgb(var(--lp-fg))]">{d.enabled ? "Aktiv" : "Ikke i avtalen"}</div>
              <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{d.enabled && d.tier ? d.tier : "—"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-4 text-sm text-[rgb(var(--lp-muted))] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-5">
          <span>Ansatte totalt: {displayCount(props.counts.employeesTotal)}</span>
          <span>Ansatte aktive: {displayCount(props.counts.employeesActive)}</span>
          <span>Ansatte deaktivert: {displayCount(props.counts.employeesDisabled)}</span>
          <span>Avbestillinger før 08:00 (7d): {displayCount(cancellationsBefore0800)}</span>
          <span>Bestillinger i dag: {displayCount(ordersTodayCount)}</span>
        </div>
        <div className="shrink-0">
          <SupportReportButton
            reason="COMPANY_ADMIN_AGREEMENT_SUPPORT_REPORT"
            companyId={companyId}
            locationId={props.locationId ?? null}
            agreementId={agreementState.agreementId ?? null}
            buttonLabel="Send systemrapport"
          />
        </div>
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-xs font-semibold text-[rgb(var(--lp-muted))]">Vis teknisk info</summary>
        <div className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
          company_id: {safeText(agreementState.companyId)} · agreement_status: {safeText(agreementState.status)} · updated_at:{" "}
          {safeText(agreementState.updatedAt)} · rid: {rid}
        </div>
      </details>
    </section>
  );
}
