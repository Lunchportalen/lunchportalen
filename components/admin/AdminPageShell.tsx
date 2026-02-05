import type { ReactNode } from "react";

type AdminPageShellProps = {
  title: string;
  subtitle?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

export default function AdminPageShell({ title, subtitle, actions, children }: AdminPageShellProps) {
  return (
    <div className="lp-container py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="lp-h1">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="grid gap-6">{children}</div>
    </div>
  );
}
