import Link from "next/link";

import {
  SuperadminBadge,
  SuperadminCommandList,
  SuperadminHero,
  SuperadminPageShell,
  SuperadminReadOnlyNotice,
  SuperadminSection,
  SuperadminStatusRail,
} from "@/components/superadmin/shell/SuperadminShell";
import type { PilotControlCenterData } from "@/lib/superadmin/loadPilotControlCenter";
import type { ChecklistLevel } from "@/lib/superadmin/pilotControlChecklist";

type Props = {
  data: PilotControlCenterData;
};

function checklistRowClass(level: ChecklistLevel): string {
  if (level === "PASS") return "sa-checklist__row sa-checklist__row--pass";
  if (level === "FAIL") return "sa-checklist__row sa-checklist__row--fail";
  return "sa-checklist__row sa-checklist__row--watch";
}

function checklistBadge(level: ChecklistLevel): string {
  if (level === "PASS") return "PASS";
  if (level === "FAIL") return "FAIL";
  return "WATCH";
}

function badgeTone(badge: PilotControlCenterData["operationalBadge"]): "go" | "watch" | "stop" {
  if (badge === "GO with manual control") return "go";
  if (badge === "WATCH") return "watch";
  return "stop";
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

  const navCommands = [
    { label: "Åpne leverandørordre", href: data.links.providerOrders, description: "Krever leverandørinnlogging." },
    ...(data.links.companyAdmin
      ? [{ label: "Åpne kunde i superadmin", href: data.links.companyAdmin, description: companyName }]
      : []),
    { label: "Åpne ukevisning", href: data.links.weekView, description: "Read-only observasjon av uke." },
  ];

  return (
    <SuperadminPageShell>
      <SuperadminHero
        variant="command"
        eyebrow="Operativ status"
        title="Pilot Control Center"
        lead="Operativ kontroll for første pilot uten å endre ordre- eller produksjonsflyt."
        footer={data.scopeNote}
        meta={
          <>
            <SuperadminBadge tone={badgeTone(data.operationalBadge)}>{data.operationalBadge}</SuperadminBadge>
            <SuperadminBadge tone="muted">Golden Path protected</SuperadminBadge>
            <span className="text-xs opacity-70">
              Sist bekreftet: <time dateTime={data.checkedAt}>{formatWhen(data.checkedAt)}</time>
            </span>
          </>
        }
      />

      {data.emptyState ? (
        <SuperadminSection title="Ingen pilot-data" lead={data.emptyMessage ?? undefined} bodyVariant="inset">
          <p className="text-sm text-[rgb(var(--lp-muted))]">
            Konfigurer <code className="text-xs">PILOT_CONTROL_COMPANY_ID</code> og{" "}
            <code className="text-xs">PILOT_CONTROL_PROVIDER_ID</code>, eller vent til første ordre gir auto-scope.
          </p>
        </SuperadminSection>
      ) : (
        <>
          <SuperadminStatusRail
            ariaLabel="Kritisk pilotstatus"
            items={[
              { label: "Leverandør", value: `${providerName} aktiv` },
              { label: "Kunde", value: `${companyName} aktiv` },
              { label: "Ansatte", value: `${data.company?.employeesActive ?? 0} aktiv`, numeric: true },
              { label: "Ordrer uke", value: data.orders.thisWeek, numeric: true },
              { label: "Produksjon", value: data.orders.productionSummary },
              { label: "Risiko", value: "Manuell kontroll uke 1" },
            ]}
          />

          <div className="sa-split sa-split--2">
            <SuperadminSection title="Golden Path checklist" lead="Bevist flyt — read-only observasjon." flat>
              <ul className="sa-checklist">
                {data.checklist.map((item) => (
                  <li key={item.id} className={checklistRowClass(item.level)}>
                    <span className="sa-checklist__status">{checklistBadge(item.level)}</span>
                    <div>
                      <p className="sa-checklist__label">{item.label}</p>
                      <p className="sa-checklist__detail">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </SuperadminSection>

            <SuperadminSection title="Verifisert pilotordre" lead="Siste observerte ordre — sannhetskilde uendret." bodyVariant="proof">
              {data.orders.latest ? (
                <dl className="sa-proof-grid">
                  <div>
                    <dt>Firma</dt>
                    <dd>{data.orders.latest.companyName}</dd>
                  </div>
                  <div>
                    <dt>Lokasjon</dt>
                    <dd>{data.orders.latest.locationName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Ansatt</dt>
                    <dd>
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
                    <dt>Status</dt>
                    <dd>{data.orders.latest.statusLabel}</dd>
                  </div>
                  <div className="sa-proof-grid__line">
                    <dt>Ordrelinje</dt>
                    <dd>{data.orders.latest.displayLine ?? "Krever oppfølging"}</dd>
                  </div>
                  <div className="sa-proof-grid__line">
                    <dt>Opprettet / oppdatert</dt>
                    <dd>
                      {formatWhen(data.orders.latest.createdAt)} · {formatWhen(data.orders.latest.updatedAt)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen ordre observert i valgt periode.</p>
              )}
            </SuperadminSection>
          </div>

          <div className="sa-split sa-split--2">
            <SuperadminSection title="Manuell kontrollplan" lead="Operativ prosedyre for pilot uke 1." bodyVariant="inset">
              <ol className="sa-procedure-list">
                <li>{providerName} sjekker ordre hver morgen</li>
                <li>{companyName} inviterer ansatte kontrollert</li>
                <li>Operatør sjekker første uke daglig</li>
                <li>Kun faktiske pilotavvik fikses — aldri fra denne siden</li>
              </ol>
            </SuperadminSection>

            <SuperadminSection title="Meny og cutoff" lead="Informasjon — ingen handling herfra." bodyVariant="inset">
              <dl className="space-y-3 text-sm">
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
              <div className="mt-4 flex flex-wrap gap-2">
                {data.healthFlags.goldenPathOk ? (
                  <SuperadminBadge tone="go">Golden Path OK</SuperadminBadge>
                ) : (
                  <SuperadminBadge tone="watch">Krever oppfølging</SuperadminBadge>
                )}
                {data.healthFlags.productionStatusFlowProven ? (
                  <SuperadminBadge tone="muted">Produksjonsflyt bevist</SuperadminBadge>
                ) : null}
                <SuperadminBadge tone="muted">Manuell kontroll</SuperadminBadge>
              </div>
            </SuperadminSection>
          </div>
        </>
      )}

      <SuperadminReadOnlyNotice
        title="Ingen handling fra denne siden"
        body="Denne siden er read-only. Golden Path skal ikke endres herfra. Sannhetskilde for ordre og produksjon ligger i eksisterende flyt."
        actions={
          <>
            {navCommands.map((cmd) => (
              <Link key={cmd.href} href={cmd.href} className="lp-btn lp-btn--secondary min-h-[44px]">
                {cmd.label}
              </Link>
            ))}
          </>
        }
      />
    </SuperadminPageShell>
  );
}
