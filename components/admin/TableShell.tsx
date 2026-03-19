import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function TableShell({ title, subtitle, children, footer }: Props) {
  return (
    <section className="lp-surface-soft mt-4 overflow-hidden rounded-card">
      <div className="border-b border-[rgb(var(--lp-border))] px-4 py-3">
        <div className="text-xs font-extrabold tracking-wide text-neutral-600">{title}</div>
        {subtitle ? <div className="text-sm font-bold text-neutral-900">{subtitle}</div> : null}
      </div>

      {children}

      {footer ? <div className="border-t border-[rgb(var(--lp-border))] px-4 py-3">{footer}</div> : null}
    </section>
  );
}
