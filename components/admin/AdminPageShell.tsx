import type { ReactNode } from "react";

type AdminPageShellProps = {
  title: string;
  subtitle?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

export default function AdminPageShell({ title, subtitle, actions, children }: AdminPageShellProps) {
  return (
    <div className="py-8">
      {/* Header: enterprise 1–3–1 (på desktop) */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
        {/* Left */}
        <div className="min-w-0">
          <h1 className="lp-h1">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{subtitle}</p> : null}
        </div>

        {/* Center (bevisst tom i denne fasen – kan brukes senere) */}
        <div className="hidden lg:block" />

        {/* Right */}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
        ) : (
          <div className="hidden lg:block" />
        )}
      </div>

      {/* Content */}
      <div className="grid gap-6">{children}</div>
    </div>
  );
}
