import type { ReactNode } from "react";
import Link from "next/link";

/* Scoped Superadmin command-center primitives — presentational only. */

export function SuperadminPageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`sa-scope sa-page ${className}`.trim()}>{children}</div>;
}

export function SuperadminHero({
  eyebrow,
  title,
  lead,
  variant = "default",
  meta,
  footer,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  variant?: "default" | "command";
  meta?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <header className={`sa-hero ${variant === "command" ? "sa-hero--command" : ""}`.trim()}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="sa-hero__eyebrow">{eyebrow}</p>
          <h1 className="sa-hero__title mt-1">{title}</h1>
          {lead ? <p className="sa-hero__lead mt-2">{lead}</p> : null}
          {footer ? <div className="mt-3 text-xs opacity-80">{footer}</div> : null}
        </div>
        {meta ? <div className="sa-hero__meta shrink-0">{meta}</div> : null}
      </div>
    </header>
  );
}

export type StatusRailItem = { label: string; value: ReactNode; numeric?: boolean };

export function SuperadminStatusRail({ items, ariaLabel }: { items: StatusRailItem[]; ariaLabel: string }) {
  return (
    <section aria-label={ariaLabel} className="sa-status-rail">
      {items.map((item) => (
        <div key={item.label} className="sa-status-rail__item">
          <p className="sa-status-rail__label">{item.label}</p>
          <p className={`sa-status-rail__value ${item.numeric ? "sa-status-rail__value--num" : ""}`.trim()}>{item.value}</p>
        </div>
      ))}
    </section>
  );
}

export function SuperadminSection({
  title,
  lead,
  action,
  children,
  bodyVariant = "default",
  flat = false,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
  children: ReactNode;
  bodyVariant?: "default" | "inset" | "proof";
  flat?: boolean;
}) {
  const bodyClass = flat
    ? "sa-section__body sa-section__body--flat"
    : bodyVariant === "inset"
      ? "sa-section__body sa-section__body--inset"
      : bodyVariant === "proof"
        ? "sa-section__body sa-section__body--proof"
        : "sa-section__body";

  return (
    <section className="sa-section">
      <div className="sa-section__head">
        <div>
          <h2 className="sa-section__title">{title}</h2>
          {lead ? <p className="sa-section__lead">{lead}</p> : null}
        </div>
        {action}
      </div>
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export type MetricCell = {
  label: string;
  value: ReactNode;
  href?: string;
  attention?: boolean;
  valueClassName?: string;
};

export function SuperadminMetricRow({ metrics }: { metrics: MetricCell[] }) {
  return (
    <div className="sa-metric-row">
      {metrics.map((m) => {
        const inner = (
          <>
            <p className="sa-metric-row__label">{m.label}</p>
            <p className={`sa-metric-row__value ${m.valueClassName ?? ""}`.trim()}>{m.value}</p>
          </>
        );
        if (m.href) {
          return (
            <Link
              key={m.label}
              href={m.href}
              className={`sa-metric-row__cell ${m.attention ? "sa-metric-row__cell--attention" : ""}`.trim()}
            >
              {inner}
            </Link>
          );
        }
        return (
          <div key={m.label} className={`sa-metric-row__cell ${m.attention ? "sa-metric-row__cell--attention" : ""}`.trim()}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export type CommandItem = { label: string; description?: string; href: string };

export function SuperadminCommandList({ items }: { items: CommandItem[] }) {
  return (
    <nav className="sa-command-list" aria-label="Kommandosnarveier">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="sa-command-list__item">
          <div className="min-w-0">
            <p className="sa-command-list__label">{item.label}</p>
            {item.description ? <p className="sa-command-list__desc">{item.description}</p> : null}
          </div>
          <span className="sa-command-list__arrow" aria-hidden>
            →
          </span>
        </Link>
      ))}
    </nav>
  );
}

export function SuperadminReadOnlyNotice({
  title,
  body,
  actions,
}: {
  title: string;
  body: string;
  actions?: ReactNode;
}) {
  return (
    <aside className="sa-readonly-notice" aria-label="Read-only">
      <p className="sa-readonly-notice__title">{title}</p>
      <p className="sa-readonly-notice__body">{body}</p>
      {actions ? <div className="sa-readonly-notice__actions">{actions}</div> : null}
    </aside>
  );
}

export function SuperadminBadge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "go" | "watch" | "stop" | "live" | "muted";
}) {
  return <span className={`sa-badge sa-badge--${tone}`}>{children}</span>;
}

export function SuperadminAsideRail({
  title,
  rows,
  actions,
}: {
  title: string;
  rows: { label: string; value: ReactNode; valueClassName?: string }[];
  actions?: ReactNode;
}) {
  return (
    <aside className="sa-aside-rail" aria-label={title}>
      <h2 className="sa-section__title">{title}</h2>
      {rows.map((row) => (
        <div key={row.label} className="sa-aside-rail__row">
          <span className="sa-aside-rail__label">{row.label}</span>
          <strong className={`sa-aside-rail__value ${row.valueClassName ?? ""}`.trim()}>{row.value}</strong>
        </div>
      ))}
      {actions ? <div className="mt-2 flex flex-col gap-2">{actions}</div> : null}
    </aside>
  );
}
