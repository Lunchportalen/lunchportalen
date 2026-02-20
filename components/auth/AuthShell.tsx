import type { ReactNode } from "react";
import AuthBrand from "./AuthBrand";

type AuthShellProps = {
  title?: string;
  subtitle?: string | null;
  children: ReactNode;
  footer?: ReactNode;
  bare?: boolean;
};

export default function AuthShell({ title, subtitle, children, footer, bare = false }: AuthShellProps) {
  if (bare) {
    return (
      <main className="relative min-h-screen w-full overflow-hidden bg-[rgb(var(--lp-bg))] px-4 py-12 text-[rgb(var(--lp-text))]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 520px at 50% 0%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.00) 60%), radial-gradient(700px 420px at 18% 18%, rgba(255,0,127,0.07) 0%, rgba(255,0,127,0.00) 55%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-[760px] items-center justify-center">
          <div className="w-full">{children}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[rgb(var(--lp-bg))] px-4 py-12 text-[rgb(var(--lp-text))]">
      {/* Soft spotlight (premium) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 520px at 50% 0%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.00) 60%), radial-gradient(700px 420px at 18% 18%, rgba(255,0,127,0.07) 0%, rgba(255,0,127,0.00) 55%)",
        }}
      />

      {/* Center */}
      <div className="relative mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-[520px] items-center justify-center">
        <div className="w-full">
          {/* Glass frame */}
          <div
            className="rounded-[22px] border p-[1px] shadow-[0_26px_80px_rgba(0,0,0,0.10)]"
            style={{
              borderColor: "rgba(var(--lp-border),0.55)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.52))",
            }}
          >
            {/* Card */}
            <div
              className="relative overflow-hidden rounded-[21px] bg-white p-8"
              style={{
                boxShadow: "var(--lp-shadow-card)",
              }}
            >
              {/* subtle sheen */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full"
                style={{
                  background: "radial-gradient(circle at 30% 30%, rgba(255,0,127,0.10), rgba(255,0,127,0.00) 65%)",
                  filter: "blur(2px)",
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-40 -bottom-40 h-80 w-80 rounded-full"
                style={{
                  background: "radial-gradient(circle at 30% 30%, rgba(176,139,87,0.10), rgba(176,139,87,0.00) 70%)",
                  filter: "blur(3px)",
                }}
              />

              <AuthBrand />

              <div className="mt-6">
                {title ? <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{title}</h1> : null}
                {subtitle ? <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--lp-muted))]">{subtitle}</p> : null}
              </div>

              <div className="mt-6">{children}</div>

              {footer ? (
                <div className="mt-6 border-t border-[rgba(var(--lp-border),0.65)] pt-4 text-center text-xs text-[rgb(var(--lp-muted))]">
                  {footer}
                </div>
              ) : null}
            </div>
          </div>

          {/* tiny trust line (optional but premium, unobtrusive) */}
          <div className="mt-6 text-center text-xs text-[rgba(var(--lp-muted),0.95)]">
            Én sannhetskilde · Cut-off 08:00 · Admin-kontroll
          </div>
        </div>
      </div>
    </main>
  );
}
