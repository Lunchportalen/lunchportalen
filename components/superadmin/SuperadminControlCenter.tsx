import Link from "next/link";

import OperationalStatusStrip from "@/app/superadmin/_components/OperationalStatusStrip";
import SuperadminDeviationIndicator from "@/components/superadmin/SuperadminDeviationIndicator";
import SuperadminRealtimeFeed from "@/components/superadmin/SuperadminRealtimeFeed";
import {
  SuperadminAsideRail,
  SuperadminBadge,
  SuperadminCommandList,
  SuperadminHero,
  SuperadminMetricRow,
  SuperadminPageShell,
  SuperadminSection,
} from "@/components/superadmin/shell/SuperadminShell";
import { capabilities } from "@/lib/superadmin/capabilities";
import type { LoadSuperadminHomeSignalsResult } from "@/lib/superadmin/loadSuperadminHomeSignals";

const PRIORITY_LINKS = [
  {
    id: "companies",
    fallbackLabel: "Firma",
    fallbackHref: "/superadmin/companies",
    description: "Firmaoversikt, firmadetaljer og ansatte per firma.",
  },
  {
    id: "agreements",
    fallbackLabel: "Avtaler",
    fallbackHref: "/superadmin/agreements",
    description: "Ventende avtaler, aktive avtaler og binding.",
  },
  {
    id: "overview-dashboard",
    fallbackLabel: "Driftsoversikt",
    fallbackHref: "/superadmin/overview",
    description: "Dagens status og viktigste tall.",
  },
  {
    id: "system",
    fallbackLabel: "Systemhelse",
    fallbackHref: "/superadmin/system",
    description: "Systemhelse, flytsjekk og revisjon.",
  },
  {
    id: "pilot-control",
    fallbackLabel: "Pilotkontroll",
    fallbackHref: "/superadmin/pilot-control",
    description: "Read-only operativ kontroll for første pilot.",
  },
];

const ADVANCED_LINKS = [
  { label: "Kontrolltårn", href: "/superadmin/control-tower", description: "Sanntidssignaler og operativ kontroll." },
  { label: "Revisjon", href: "/superadmin/audit", description: "Auditlogg og sporbarhet." },
  { label: "Operasjoner", href: "/superadmin/operations", description: "Dagens leveranser og operativ oversikt." },
  { label: "Tripletex", href: "/superadmin/tripletex", description: "Fakturagrunnlag og eksport." },
  { label: "Global", href: "/superadmin/global", description: "Global styringsflate." },
];

function capabilityById(id: string) {
  return capabilities.find((capability) => capability.enabled && capability.id === id);
}

function pendingValueClass(value: number) {
  if (value > 50) return "text-red-600";
  if (value > 0) return "text-amber-600";
  return "";
}

function productionTodayValueClass(value: number) {
  return value === 0 ? "text-amber-600" : "";
}

export default function SuperadminControlCenter({ signals }: { signals: LoadSuperadminHomeSignalsResult }) {
  const s = signals.ok ? signals.data : null;
  const priorityCommands = PRIORITY_LINKS.map((link) => {
    const capability = capabilityById(link.id);
    return {
      label: capability?.label ?? link.fallbackLabel,
      description: link.description,
      href: capability?.href ?? link.fallbackHref,
    };
  });
  const alertCount = s ? s.companies.pending + s.pendingAgreements : "—";
  const healthLabel = signals.ok ? "OK" : "Krever sjekk";

  return (
    <SuperadminPageShell>
      <div className="sa-split sa-split--aside">
        <div className="min-w-0 flex flex-col gap-[var(--sa-section-gap)]">
          <SuperadminHero
            variant="command"
            eyebrow="Operativ kontroll"
            title="Kontrollsenter"
            lead="Drift, firma, avtaler og systemstatus — samlet kontrollrom for superadmin."
            meta={
              <>
                <SuperadminBadge tone="live">Live</SuperadminBadge>
                <SuperadminBadge tone={signals.ok ? "muted" : "watch"}>Helse {healthLabel}</SuperadminBadge>
                <SuperadminBadge tone={s && Number(alertCount) > 0 ? "watch" : "muted"}>Varsler {alertCount}</SuperadminBadge>
              </>
            }
          />

          <OperationalStatusStrip placement="embedded" />

          {s ? (
            <SuperadminSection
              title="Kontrollsignaler"
              lead="Konsentrert status fra drift, firma og avtaler."
              action={
                <Link href="/superadmin/system" className="text-sm font-semibold underline-offset-4 hover:underline">
                  Systemhelse →
                </Link>
              }
              flat
            >
              <SuperadminMetricRow
                metrics={[
                  {
                    label: "Firma venter",
                    value: s.companies.pending,
                    href: "/superadmin/companies",
                    attention: s.companies.pending > 0,
                    valueClassName: pendingValueClass(s.companies.pending),
                  },
                  {
                    label: "Avtaler venter",
                    value: s.pendingAgreements,
                    href: "/superadmin/agreements",
                    attention: s.pendingAgreements > 0,
                    valueClassName: pendingValueClass(s.pendingAgreements),
                  },
                  {
                    label: "Ordre i dag",
                    value: s.orders.today,
                    href: "/superadmin/overview",
                    valueClassName: productionTodayValueClass(s.orders.today),
                  },
                  {
                    label: "Ordre denne uken",
                    value: s.orders.week,
                    href: "/superadmin/overview",
                  },
                ]}
              />
            </SuperadminSection>
          ) : (
            <p className="text-sm text-amber-900">
              Kontrollsignaler kunne ikke lastes ({signals.ok === false ? signals.reason : ""}). Bruk kommandolisten under.
            </p>
          )}

          <SuperadminSection title="Live hendelser" lead="Sanntidsstrøm uten ekstra kortlag." flat>
            <SuperadminRealtimeFeed initialOrdersToday={s ? s.orders.today : 0} />
          </SuperadminSection>

          <SuperadminDeviationIndicator />

          <SuperadminSection title="Kommandosnarveier" lead="Primære kontrollflater — én handling per rad.">
            <SuperadminCommandList items={priorityCommands} />
          </SuperadminSection>

          <SuperadminSection title="Avansert" lead="Dypere kontroll uten visuell støy." bodyVariant="inset">
            <SuperadminCommandList items={ADVANCED_LINKS} />
          </SuperadminSection>
        </div>

        <SuperadminAsideRail
          title="Dagens oppsummering"
          rows={[
            {
              label: "Produksjon i dag",
              value: s ? s.orders.today : "—",
              valueClassName: s ? productionTodayValueClass(s.orders.today) : "",
            },
            {
              label: "Ventende avtaler",
              value: s ? s.pendingAgreements : "—",
              valueClassName: s ? pendingValueClass(s.pendingAgreements) : "",
            },
            {
              label: "Systemhelse",
              value: healthLabel,
              valueClassName: signals.ok ? "text-emerald-800" : "text-amber-900",
            },
            { label: "Sist oppdatert", value: "Live" },
          ]}
          actions={
            <>
              <Link href="/superadmin/audit" className="lp-btn lp-btn--secondary min-h-[44px] w-full justify-center">
                Revisjon
              </Link>
              <Link href="/superadmin/pilot-control" className="lp-btn lp-btn--ghost min-h-[44px] w-full justify-center">
                Pilotkontroll
              </Link>
            </>
          }
        />
      </div>
    </SuperadminPageShell>
  );
}
