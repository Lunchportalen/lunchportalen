import Link from "next/link";

import type { PilotControlCenterData } from "@/lib/superadmin/loadPilotControlCenter";
import type { ChecklistLevel } from "@/lib/superadmin/pilotControlChecklist";

type Props = {
  data: PilotControlCenterData;
};

function checklistClass(level: ChecklistLevel): string {
  if (level === "PASS") return "lp-pilot-checklist__item--pass";
  if (level === "FAIL") return "lp-pilot-checklist__item--fail";
  return "lp-pilot-checklist__item--watch";
}

function checklistBadge(level: ChecklistLevel): string {
  if (level === "PASS") return "PASS";
  if (level === "FAIL") return "FAIL";
  return "WATCH";
}

function badgeClass(badge: PilotControlCenterData["operationalBadge"]): string {
  if (badge === "GO with manual control") return "lp-pilot-badge lp-pilot-badge--go";
  if (badge === "WATCH") return "lp-pilot-badge lp-pilot-badge--watch";
  return "lp-pilot-badge lp-pilot-badge--stop";
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("nb-NO", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export default function PilotControlCenterView({ data }: Props) {
  const providerName = data.provider?.name ?? "Leverandør";
  const companyName = data.company?.name ?? "Kunde";

  return (
    <div className="lp-pilot-control space-y-8">
      <header className="lp-pilot-control__hero">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--lp-muted))]">Operativ status</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--lp-fg))]">Pilot Control Center</h1>
            <p className="max-w-2xl text-sm text-[rgb(var(--lp-muted))]">
              Operativ kontroll for første pilot uten å endre ordre- eller produksjonsflyt.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <span className={badgeClass(data.operationalBadge)}>{data.operationalBadge}</span>
            <span className="text-xs font-medium text-[rgb(var(--lp-muted))]">Golden Path protected</span>
            <span className="text-xs text-[rgb(var(--lp-muted))]">
              Sist bekreftet: <time dateTime={data.checkedAt}>{formatWhen(data.checkedAt)}</time>
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">{data.scopeNote}</p>
      </header>

      {data.emptyState ? (
        <section className="lp-pilot-card lp-pilot-card--muted" aria-live="polite">
          <h2 className="text-lg font-semibold text-[rgb(var(--lp-fg))]">Ingen pilot-data</h2>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{data.emptyMessage}</p>
          <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">
            Konfigurer <code className="text-xs">PILOT_CONTROL_COMPANY_ID</code> og{" "}
            <code className="text-xs">PILOT_CONTROL_PROVIDER_ID</code>, eller vent til første ordre gir auto-scope.
          </p>
        </section>
      ) : null}

      <section aria-label="Kritisk status" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="lp-pilot-strip-card">
          <p className="lp-pilot-strip-card__label">Leverandør</p>
          <p className="lp-pilot-strip-card__value">{providerName} aktiv</p>
        </div>
        <div className="lp-pilot-strip-card">
          <p className="lp-pilot-strip-card__label">Kunde</p>
          <p className="lp-pilot-strip-card__value">{companyName} aktiv</p>
        </div>
        <div className="lp-pilot-strip-card">
          <p className="lp-pilot-strip-card__label">Ansatte</p>
          <p className="lp-pilot-strip-card__value">{data.company?.employeesActive ?? 0} aktiv</p>
        </div>
        <div className="lp-pilot-strip-card">
          <p className="lp-pilot-strip-card__label">Ordrer denne uken</p>
          <p className="lp-pilot-strip-card__value tabular-nums">{data.orders.thisWeek}</p>
        </div>
        <div className="lp-pilot-strip-card">
          <p className="lp-pilot-strip-card__label">Produksjon</p>
          <p className="lp-pilot-strip-card__value">{data.orders.productionSummary}</p>
        </div>
        <div className="lp-pilot-strip-card">
          <p className="lp-pilot-strip-card__label">Risiko</p>
          <p className="lp-pilot-strip-card__value">Manuell kontroll uke 1</p>
        </div>
      </section>

      <section className="lp-pilot-card" aria-labelledby="pilot-checklist-heading">
        <h2 id="pilot-checklist-heading" className="text-lg font-semibold text-[rgb(var(--lp-fg))]">
          Golden Path checklist
        </h2>
        <ul className="lp-pilot-checklist mt-4 space-y-2">
          {data.checklist.map((item) => (
            <li key={item.id} className={`lp-pilot-checklist__item ${checklistClass(item.level)}`}>
              <span className="lp-pilot-checklist__badge">{checklistBadge(item.level)}</span>
              <div>
                <p className="font-medium text-[rgb(var(--lp-fg))]">{item.label}</p>
                <p className="text-sm text-[rgb(var(--lp-muted))]">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="lp-pilot-card" aria-labelledby="pilot-latest-order-heading">
        <h2 id="pilot-latest-order-heading" className="text-lg font-semibold text-[rgb(var(--lp-fg))]">
          Siste pilotordre
        </h2>
        {data.orders.latest ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Firma</dt>
              <dd className="font-medium">{data.orders.latest.companyName}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Lokasjon</dt>
              <dd className="font-medium">{data.orders.latest.locationName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Ansatt</dt>
              <dd className="font-medium">
                {data.orders.latest.employeeName}
                {data.orders.latest.employeeEmail ? (
                  <>
                    {" "}
                    /{" "}
                    <a className="underline decoration-neutral-300" href={`mailto:${data.orders.latest.employeeEmail}`}>
                      {data.orders.latest.employeeEmail}
                    </a>
                  </>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Ordrelinje</dt>
              <dd className="font-medium">{data.orders.latest.displayLine ?? "Krever oppfølging"}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Status</dt>
              <dd className="font-medium">{data.orders.latest.statusLabel}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Opprettet / oppdatert</dt>
              <dd className="font-medium">
                {formatWhen(data.orders.latest.createdAt)} · {formatWhen(data.orders.latest.updatedAt)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Ingen ordre observert i valgt periode.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="lp-pilot-card" aria-labelledby="pilot-manual-plan-heading">
          <h2 id="pilot-manual-plan-heading" className="text-lg font-semibold text-[rgb(var(--lp-fg))]">
            Manuell kontrollplan
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-[rgb(var(--lp-muted))]">
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>
                {providerName} sjekker ordre hver morgen
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{companyName} inviterer ansatte kontrollert</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>Operatør sjekker første uke daglig</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>Kun faktiske pilotavvik fikses — aldri fra denne siden</span>
            </li>
          </ul>
        </section>

        <section className="lp-pilot-card" aria-labelledby="pilot-readiness-heading">
          <h2 id="pilot-readiness-heading" className="text-lg font-semibold text-[rgb(var(--lp-fg))]">
            Meny og cutoff
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Menystatus</dt>
              <dd>{data.menu.detail}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Cutoff i dag</dt>
              <dd>{data.cutoff.todayLabel}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Produksjon etter cutoff</dt>
              <dd>{data.cutoff.detail}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {data.healthFlags.goldenPathOk ? (
              <span className="lp-pilot-flag lp-pilot-flag--ok">Golden Path OK</span>
            ) : (
              <span className="lp-pilot-flag lp-pilot-flag--watch">Golden Path — krever oppfølging</span>
            )}
            {data.healthFlags.providerOrderVisible ? (
              <span className="lp-pilot-flag lp-pilot-flag--ok">Provider order visible</span>
            ) : null}
            {data.healthFlags.employeeOrderExists ? (
              <span className="lp-pilot-flag lp-pilot-flag--ok">Employee order exists</span>
            ) : null}
            {data.healthFlags.productionStatusFlowProven ? (
              <span className="lp-pilot-flag lp-pilot-flag--ok">Production status flow proven</span>
            ) : null}
            <span className="lp-pilot-flag lp-pilot-flag--info">Manual control required</span>
          </div>
        </section>
      </div>

      <section className="lp-pilot-card lp-pilot-card--warning" aria-labelledby="pilot-protected-heading">
        <h2 id="pilot-protected-heading" className="text-base font-semibold text-[rgb(var(--lp-fg))]">
          Ingen handling fra denne siden
        </h2>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Denne siden er read-only. Golden Path skal ikke endres herfra. Sannhetskilde for ordre og produksjon ligger i
          eksisterende flyt.
        </p>
        <nav aria-label="Trygg navigasjon" className="mt-4 flex flex-wrap gap-2">
          <Link href={data.links.providerOrders} className="lp-btn lp-btn--secondary min-h-[44px]">
            Åpne leverandørordre
          </Link>
          {data.links.companyAdmin ? (
            <Link href={data.links.companyAdmin} className="lp-btn lp-btn--secondary min-h-[44px]">
              Åpne kunde i superadmin
            </Link>
          ) : null}
          <Link href={data.links.weekView} className="lp-btn lp-btn--ghost min-h-[44px]">
            Åpne ukevisning
          </Link>
        </nav>
      </section>
    </div>
  );
}
