import Link from "next/link";

import OperationalStatusStrip from "@/app/superadmin/_components/OperationalStatusStrip";
import { capabilities, capabilitiesByGroup } from "@/lib/superadmin/capabilities";
import type { LoadSuperadminHomeSignalsResult } from "@/lib/superadmin/loadSuperadminHomeSignals";

import SuperadminCard from "./SuperadminCard";

const PRESERVED_LINKS: { label: string; href: string }[] = [
  { label: "Registreringer", href: "/superadmin/registrations" },
  { label: "Revisjon", href: "/superadmin/audit" },
  { label: "Gå til ukeplan", href: "/week" },
  { label: "Kontrolltårn", href: "/superadmin/control-tower" },
  { label: "Global", href: "/superadmin/global" },
  { label: "Pipeline", href: "/superadmin/pipeline" },
  { label: "Investor", href: "/superadmin/investor" },
  { label: "AI CTO", href: "/superadmin/cto" },
  { label: "Salg", href: "/superadmin/sales" },
  { label: "Salgsloop", href: "/superadmin/sales-loop" },
  { label: "Salgsagent", href: "/superadmin/sales-agent" },
  { label: "Produksjonssjekk", href: "/superadmin/production-check" },
  { label: "Systemgraf", href: "/superadmin/system-graph" },
  { label: "AI-strategi", href: "/superadmin/strategy" },
  { label: "Autonomi", href: "/superadmin/autonomy" },
  { label: "Eksperimenter", href: "/superadmin/experiments" },
];

const SECTION_COPY: Record<string, string> = {
  core: "Selskaper, avtaler, brukere og økonomisk grunnlag.",
  operations: "Daglig drift, systemkjøring og operativ oppfølging.",
  growth: "Innhold, vekst og kontrollert kommersiell produksjon.",
  system: "Systemhelse, revisjon og ledelsesflater.",
};

const PROCESS_STEPS = ["Kontroll", "Drift", "Avtaler", "System"];

const PRIORITY_LINKS = [
  { id: "companies", fallbackLabel: "Firma", fallbackHref: "/superadmin/companies" },
  { id: "agreements", fallbackLabel: "Avtaler", fallbackHref: "/superadmin/agreements" },
  { id: "users", fallbackLabel: "Brukere", fallbackHref: "/superadmin/users" },
  { id: "kitchen", fallbackLabel: "Kjøkken", fallbackHref: "/kitchen", description: "Produksjon og kjøkkenflate." },
  { id: "overview-dashboard", fallbackLabel: "Driftsoversikt", fallbackHref: "/superadmin/overview" },
  { id: "system", fallbackLabel: "Systemhelse", fallbackHref: "/superadmin/system" },
];

function capabilityById(id: string) {
  return capabilities.find((capability) => capability.enabled && capability.id === id);
}

function SignalCard({
  label,
  value,
  href,
  variant,
}: {
  label: string;
  value: string | number;
  href: string;
  variant?: "default" | "attention";
}) {
  const shell =
    variant === "attention"
      ? "rounded-[1.35rem] bg-amber-50/85 p-4 ring-1 ring-amber-200/70"
      : "rounded-[1.35rem] bg-[#faf6ed] p-4 ring-1 ring-black/[0.04]";
  return (
    <Link
      href={href}
      className={`block transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 ${shell}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--lp-muted))]">{label}</div>
      <div className="mt-2 font-heading text-3xl font-semibold tabular-nums text-[rgb(var(--lp-fg))]">{value}</div>
    </Link>
  );
}

function StatusPill({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "live" | "warn" }) {
  const toneClass =
    tone === "live"
      ? "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200/70"
      : tone === "warn"
        ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200/70"
        : "bg-white/80 text-[rgb(var(--lp-fg))] ring-1 ring-black/[0.06]";

  return (
    <span className={`inline-flex min-h-[34px] items-center gap-2 rounded-full px-3 text-xs font-semibold ${toneClass}`}>
      {tone === "live" ? <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden /> : null}
      <span className="uppercase tracking-[0.12em] opacity-70">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

export default function SuperadminControlCenter({ signals }: { signals: LoadSuperadminHomeSignalsResult }) {
  const sections = capabilitiesByGroup();
  const s = signals.ok ? signals.data : null;
  const priorityCards = PRIORITY_LINKS.map((link) => {
    const capability = capabilityById(link.id);
    return {
      id: link.id,
      label: capability?.label ?? link.fallbackLabel,
      description: link.description ?? capability?.description,
      href: capability?.href ?? link.fallbackHref,
    };
  });
  const alertCount = s ? s.companies.pending + s.pendingAgreements : "—";
  const healthLabel = signals.ok ? "OK" : "Krever sjekk";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_276px]">
        <div className="min-w-0">
          <section aria-labelledby="superadmin-title">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(var(--lp-muted))]">Kontrollflate</p>
                <h1 id="superadmin-title" className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em] text-[rgb(var(--lp-fg))] sm:text-4xl">
                  Superadmin
                </h1>
                <p className="mt-2 text-sm leading-6 text-[rgb(var(--lp-muted))]">
                  Kontrollflate for drift, avtaler, selskaper og systemstatus.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill label="LIVE" value="Aktiv" tone="live" />
                <StatusPill label="Helse" value={healthLabel} tone={signals.ok ? "default" : "warn"} />
                <StatusPill label="Varsler" value={alertCount} tone={s && Number(alertCount) > 0 ? "warn" : "default"} />
                <StatusPill label="Trend" value="Stabil" />
              </div>
            </div>

            <OperationalStatusStrip placement="embedded" />

            <div className="mt-6 grid gap-2 sm:grid-cols-4">
              {PROCESS_STEPS.map((step, index) => (
                <div key={step} className="flex min-h-[58px] items-center gap-3 rounded-[1.15rem] bg-[#faf6ed] px-3 py-3 ring-1 ring-black/[0.035]">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white">{index + 1}</div>
                  <div className="text-sm font-semibold text-[rgb(var(--lp-fg))]">{step}</div>
                </div>
              ))}
            </div>
          </section>

          {s ? (
            <section aria-labelledby="superadmin-signals-heading" className="mt-7">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="superadmin-signals-heading" className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">
                    Kontrollsignaler
                  </h2>
                  <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Konsentrert status fra drift, firma og avtaler.</p>
                </div>
                <Link href="/superadmin/system" className="text-sm font-semibold text-[rgb(var(--lp-fg))] underline-offset-4 hover:underline">
                  Systemhelse
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SignalCard
                  label="Firma venter"
                  value={s.companies.pending}
                  href="/superadmin/companies"
                  variant={s.companies.pending > 0 ? "attention" : "default"}
                />
                <SignalCard
                  label="Avtaler venter godkjenning"
                  value={s.pendingAgreements}
                  href="/superadmin/agreements"
                  variant={s.pendingAgreements > 0 ? "attention" : "default"}
                />
                <SignalCard label="Ordre i dag" value={s.orders.today} href="/superadmin/overview" />
                <SignalCard label="Ordre denne uken" value={s.orders.week} href="/superadmin/overview" />
              </div>
            </section>
          ) : (
            <div className="mt-5 rounded-[1.15rem] bg-amber-50/85 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200/70">
              Kontrollsignaler kunne ikke lastes ({signals.ok === false ? signals.reason : ""}). Bruk lenkene under og driftssider som vanlig.
            </div>
          )}

          <section aria-labelledby="superadmin-priority-heading" className="mt-7">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="superadmin-priority-heading" className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">
                  Prioriterte snarveier
                </h2>
                <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">De mest brukte kontrollflatene først.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {priorityCards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group rounded-[1.25rem] bg-[#faf6ed] p-4 ring-1 ring-black/[0.04] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">{card.label}</h3>
                      {card.description ? <p className="mt-1 line-clamp-2 text-sm leading-5 text-[rgb(var(--lp-muted))]">{card.description}</p> : null}
                    </div>
                    <span className="text-lg leading-none text-[rgb(var(--lp-muted))] transition group-hover:translate-x-0.5 group-hover:text-[rgb(var(--lp-fg))]" aria-hidden>
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="superadmin-all-heading" className="mt-8 space-y-4">
            <div>
              <h2 id="superadmin-all-heading" className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">
                Flere innganger
              </h2>
              <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Kompakt tilgang til øvrige superadmin-flater.</p>
            </div>

            {sections.map(({ group, label, items }) => (
              <section
                key={group}
                aria-labelledby={`superadmin-group-${group}`}
                className="rounded-[1.35rem] bg-[#fbf8f0]/70 p-3 ring-1 ring-black/[0.035]"
              >
                <div className="mb-2 px-1">
                  <h3 id={`superadmin-group-${group}`} className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">
                    {label}
                  </h3>
                  <p className="mt-0.5 text-sm text-[rgb(var(--lp-muted))]">{SECTION_COPY[group] ?? "Kontrollflater for superadmin."}</p>
                </div>
                <div className="grid gap-2">
                  {items.map((c) => (
                    <SuperadminCard
                      key={c.id}
                      id={c.id}
                      title={c.label}
                      description={c.description}
                      href={c.href}
                      primaryAction={c.id === "overview-dashboard"}
                    />
                  ))}
                </div>
              </section>
            ))}

            <section className="rounded-[1.35rem] bg-[#fbf8f0]/70 p-3 ring-1 ring-black/[0.035]" aria-labelledby="superadmin-preserved-heading">
              <div className="mb-2 px-1">
                <h3 id="superadmin-preserved-heading" className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">
                  Beholdte snarveier
                </h3>
                <p className="mt-0.5 text-sm text-[rgb(var(--lp-muted))]">Tidligere toppnavigasjon er flyttet hit som diskrete rader.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {PRESERVED_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-[44px] items-center justify-between rounded-2xl bg-white/80 px-3 text-sm font-medium text-[rgb(var(--lp-fg))] transition hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                  >
                    <span>{item.label}</span>
                    <span aria-hidden>→</span>
                  </Link>
                ))}
              </div>
            </section>
          </section>
        </div>

        <aside className="rounded-[1.75rem] bg-white/76 p-4 ring-1 ring-white/85 lg:sticky lg:top-6 lg:self-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(var(--lp-muted))]">Oppsummering</p>
            <h2 className="mt-2 font-heading text-xl font-semibold text-[rgb(var(--lp-fg))]">Dagens status</h2>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#fbf8f0] px-3 py-2 text-sm">
                <span className="text-[rgb(var(--lp-muted))]">Produksjon i dag</span>
                <strong className="tabular-nums text-[rgb(var(--lp-fg))]">{s ? s.orders.today : "—"}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#fbf8f0] px-3 py-2 text-sm">
                <span className="text-[rgb(var(--lp-muted))]">Ventende avtaler</span>
                <strong className="tabular-nums text-[rgb(var(--lp-fg))]">{s ? s.pendingAgreements : "—"}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#fbf8f0] px-3 py-2 text-sm">
                <span className="text-[rgb(var(--lp-muted))]">Systemhelse</span>
                <strong className={signals.ok ? "text-emerald-800" : "text-amber-900"}>{healthLabel}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#fbf8f0] px-3 py-2 text-sm">
                <span className="text-[rgb(var(--lp-muted))]">Siste oppdatering</span>
                <strong className="text-[rgb(var(--lp-fg))]">Live</strong>
              </div>
            </div>
            <Link
              href="/kitchen"
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-amber-300 bg-amber-300 px-4 text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              Gå til kjøkken
            </Link>
            <Link
              href="/superadmin/overview"
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-semibold text-[rgb(var(--lp-fg))] transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
            >
              Se produksjon
            </Link>
          </div>
        </aside>
      </div>
  );
}
