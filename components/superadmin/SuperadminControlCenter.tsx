import Link from "next/link";

import PageSection from "@/components/layout/PageSection";
import { capabilitiesByGroup } from "@/lib/superadmin/capabilities";
import type { LoadSuperadminHomeSignalsResult } from "@/lib/superadmin/loadSuperadminHomeSignals";

import SuperadminCard from "./SuperadminCard";

const QUICK_LINKS: { label: string; href: string }[] = [
  { label: "Morgenoversikt", href: "/superadmin/daily-brief" },
  { label: "Driftsoversikt", href: "/superadmin/overview" },
  { label: "Systemhelse", href: "/superadmin/system" },
  { label: "Ventende avtaler", href: "/superadmin/agreements" },
  { label: "Firma", href: "/superadmin/companies" },
  { label: "Registreringer", href: "/superadmin/registrations" },
  { label: "Brukere", href: "/superadmin/users" },
  { label: "Revisjon", href: "/superadmin/audit" },
  { label: "Gå til ukeplan", href: "/week" },
  { label: "Kjøkken", href: "/kitchen" },
  { label: "Backoffice", href: "/backoffice/content" },
];

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
      ? "rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm"
      : "rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 p-4 shadow-sm";
  return (
    <Link href={href} className={`block transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${shell}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">{label}</div>
      <div className="mt-1 font-heading text-2xl font-semibold tabular-nums text-[rgb(var(--lp-fg))]">{value}</div>
      <div className="mt-2 text-xs font-medium text-[rgb(var(--lp-muted))]">Åpne →</div>
    </Link>
  );
}

export default function SuperadminControlCenter({ signals }: { signals: LoadSuperadminHomeSignalsResult }) {
  const sections = capabilitiesByGroup();
  const s = signals.ok ? signals.data : null;

  return (
    <div className="space-y-10">
      <PageSection title="Superadmin" subtitle="Kontrollflate — godkjenning, selskaper, drift og systemstatus (lesing først).">
        <div className="flex flex-wrap gap-2 border-b border-[rgb(var(--lp-border))] pb-6">
          {QUICK_LINKS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
            >
              {q.label}
            </Link>
          ))}
        </div>
      </PageSection>

      {s ? (
        <section aria-labelledby="superadmin-signals-heading" className="space-y-4">
          <h2 id="superadmin-signals-heading" className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">
            Kontrollsignaler
          </h2>
          <p className="text-sm text-[rgb(var(--lp-muted))]">
            Tall fra samme grunnlag som driftssiden (firmastatus, ordre, ventende avtaler). Ingen nye sannheter — kun lesing.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SignalCard
              label="Firma (venter)"
              value={s.companies.pending}
              href="/superadmin/companies"
              variant={s.companies.pending > 0 ? "attention" : "default"}
            />
            <SignalCard
              label="Avtaler (venter godkjenning)"
              value={s.pendingAgreements}
              href="/superadmin/agreements"
              variant={s.pendingAgreements > 0 ? "attention" : "default"}
            />
            <SignalCard label="Ordre i dag" value={s.orders.today} href="/superadmin/overview" />
            <SignalCard label="Ordre denne uken" value={s.orders.week} href="/superadmin/overview" />
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-[rgb(var(--lp-muted))]">
            <span>
              Pausede firma: <strong className="text-[rgb(var(--lp-fg))]">{s.companies.paused}</strong>
            </span>
            <span aria-hidden="true">
              ·
            </span>
            <span>
              Stengte: <strong className="text-[rgb(var(--lp-fg))]">{s.companies.closed}</strong>
            </span>
            <span aria-hidden="true">
              ·
            </span>
            <Link href="/superadmin/system" className="font-medium text-[rgb(var(--lp-fg))] underline-offset-4 hover:underline">
              Systemhelse og flytdiagnostikk
            </Link>
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          Kontrollsignaler kunne ikke lastes ({signals.ok === false ? signals.reason : ""}). Bruk lenkene under og driftssider som vanlig.
        </div>
      )}

      {sections.map(({ group, label, items }) => (
        <section key={group} aria-labelledby={`superadmin-group-${group}`} className="space-y-4">
          <h2 id={`superadmin-group-${group}`} className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">
            {label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
