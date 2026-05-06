import Link from "next/link";

import { capabilities, capabilitiesByGroup } from "@/lib/superadmin/capabilities";
import type { LoadSuperadminHomeSignalsResult } from "@/lib/superadmin/loadSuperadminHomeSignals";

import SuperadminCard from "./SuperadminCard";

const SIDEBAR_LINKS: { label: string; href: string }[] = [
  { label: "Kontrollsenter", href: "/superadmin" },
  { label: "Morgenoversikt", href: "/superadmin/daily-brief" },
  { label: "Driftsoversikt", href: "/superadmin/overview" },
  { label: "Firma", href: "/superadmin/companies" },
  { label: "Avtaler", href: "/superadmin/agreements" },
  { label: "Brukere", href: "/superadmin/users" },
  { label: "Kjøkken", href: "/kitchen" },
  { label: "Backoffice", href: "/backoffice/content" },
  { label: "Systemhelse", href: "/superadmin/system" },
];

const PRESERVED_LINKS: { label: string; href: string }[] = [
  { label: "Registreringer", href: "/superadmin/registrations" },
  { label: "Revisjon", href: "/superadmin/audit" },
  { label: "Gå til ukeplan", href: "/week" },
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
      ? "rounded-[1.25rem] border border-amber-200 bg-amber-50/90 p-4 shadow-sm"
      : "rounded-[1.25rem] border border-[rgb(var(--lp-border))] bg-white/90 p-4 shadow-sm";
  return (
    <Link
      href={href}
      className={`block transition-shadow hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 ${shell}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--lp-muted))]">{label}</div>
      <div className="mt-2 font-heading text-3xl font-semibold tabular-nums text-[rgb(var(--lp-fg))]">{value}</div>
    </Link>
  );
}

function StatusPill({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "live" | "warn" }) {
  const toneClass =
    tone === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-[rgb(var(--lp-border))] bg-white/85 text-[rgb(var(--lp-fg))]";

  return (
    <span className={`inline-flex min-h-[34px] items-center gap-2 rounded-full border px-3 text-xs font-semibold ${toneClass}`}>
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
    <div className="rounded-[2rem] border border-[rgb(var(--lp-border))] bg-[#f7f2e8] p-2 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[210px_minmax(0,1fr)_280px]">
        <aside className="rounded-[1.5rem] border border-white/70 bg-white/80 p-3 shadow-sm lg:sticky lg:top-6 lg:self-start">
          <Link
            href="/"
            className="flex min-h-[52px] items-center rounded-2xl px-2 text-sm font-semibold text-[rgb(var(--lp-fg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            Lunchportalen
          </Link>
          <nav aria-label="Superadmin hovedmeny" className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap">
            {SIDEBAR_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex min-h-[44px] items-center rounded-2xl border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
                  item.href === "/superadmin"
                    ? "border-neutral-900 bg-neutral-950 text-white"
                    : "border-transparent bg-transparent text-[rgb(var(--lp-muted))] hover:border-[rgb(var(--lp-border))] hover:bg-white/80 hover:text-[rgb(var(--lp-fg))]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-sm sm:p-5">
          <section aria-labelledby="superadmin-title" className="rounded-[1.5rem] border border-[rgb(var(--lp-border))] bg-white p-4 shadow-sm sm:p-5">
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

            <div className="mt-5 grid gap-2 sm:grid-cols-4">
              {PROCESS_STEPS.map((step, index) => (
                <div key={step} className="rounded-2xl border border-[rgb(var(--lp-border))] bg-[#fbf8f0] px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--lp-muted))]">{index + 1}</div>
                  <div className="mt-1 text-sm font-semibold text-[rgb(var(--lp-fg))]">{step}</div>
                </div>
              ))}
            </div>
          </section>

          {s ? (
            <section aria-labelledby="superadmin-signals-heading" className="mt-4 rounded-[1.5rem] border border-[rgb(var(--lp-border))] bg-[#fbf8f0] p-4 shadow-sm">
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
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
              Kontrollsignaler kunne ikke lastes ({signals.ok === false ? signals.reason : ""}). Bruk lenkene under og driftssider som vanlig.
            </div>
          )}

          <section aria-labelledby="superadmin-priority-heading" className="mt-4 rounded-[1.5rem] border border-[rgb(var(--lp-border))] bg-white p-4 shadow-sm">
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
                  className="group rounded-[1.25rem] border border-[rgb(var(--lp-border))] bg-[#fbf8f0] p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">{card.label}</h3>
                      {card.description ? <p className="mt-1 line-clamp-2 text-sm leading-5 text-[rgb(var(--lp-muted))]">{card.description}</p> : null}
                    </div>
                    <span className="rounded-full border border-[rgb(var(--lp-border))] bg-white px-2.5 py-1 text-xs font-semibold text-[rgb(var(--lp-fg))]">
                      Åpne
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="superadmin-all-heading" className="mt-4 space-y-3">
            <div className="rounded-[1.5rem] border border-[rgb(var(--lp-border))] bg-white/80 p-4">
              <h2 id="superadmin-all-heading" className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">
                Alle kontrollflater
              </h2>
              <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Komprimert oversikt. Tilganger og lenker er beholdt.</p>
            </div>

            {sections.map(({ group, label, items }) => (
              <section
                key={group}
                aria-labelledby={`superadmin-group-${group}`}
                className="rounded-[1.5rem] border border-[rgb(var(--lp-border))] bg-white/80 p-3 shadow-sm"
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

            <section className="rounded-[1.5rem] border border-[rgb(var(--lp-border))] bg-white/80 p-3 shadow-sm" aria-labelledby="superadmin-preserved-heading">
              <div className="mb-2 px-1">
                <h3 id="superadmin-preserved-heading" className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">
                  Flere innganger
                </h3>
                <p className="mt-0.5 text-sm text-[rgb(var(--lp-muted))]">Eksisterende snarveier som ikke skal dominere første skjerm.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {PRESERVED_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-[44px] items-center justify-between rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm font-medium text-[rgb(var(--lp-fg))] transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                  >
                    <span>{item.label}</span>
                    <span aria-hidden>→</span>
                  </Link>
                ))}
              </div>
            </section>
          </section>
        </main>

        <aside className="rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-sm lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[1.5rem] border border-[rgb(var(--lp-border))] bg-white p-4">
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
    </div>
  );
}
