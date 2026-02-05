import type { ReactNode } from "react";
import AuthBrand from "./AuthBrand";

type AuthShellProps = {
  title: string;
  subtitle?: string | null;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="min-h-screen w-screen flex items-center justify-center lp-auth-spotlight text-[rgb(var(--lp-text))]">
      <div className="w-full max-w-[520px]">
        <div className="mx-4 rounded-[var(--lp-radius-card)] border border-[rgb(var(--lp-border))] bg-white p-6 shadow-[var(--lp-shadow-soft)]">
          <AuthBrand />
          <div className="mt-5">
            <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{subtitle}</p> : null}
          </div>
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mx-4 mt-6 text-xs text-[rgb(var(--lp-muted))]">{footer}</div> : null}
      </div>
    </main>
  );
}
