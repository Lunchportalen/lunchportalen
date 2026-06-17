"use client";

import { LogoutClientButton } from "@/components/auth/LogoutClient";

type Props = {
  roleLabel: string;
  email?: string | null;
  className?: string;
};

/** Visible account + logout block for authenticated app sidebars (no dropdown-only). */
export function AuthenticatedShellAccount({ roleLabel, email, className }: Props) {
  return (
    <section
      aria-label="Konto"
      className={["mt-auto border-t border-black/[0.06] pt-3", className].filter(Boolean).join(" ")}
    >
      <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--lp-muted))]">Konto</p>
      <div className="mt-2 px-3">
        <p className="text-xs font-semibold text-[rgb(var(--lp-fg))]">{roleLabel}</p>
        {email ? (
          <p className="mt-0.5 truncate text-xs text-[rgb(var(--lp-muted))]" title={email}>
            {email}
          </p>
        ) : null}
      </div>
      <div className="mt-3 px-2">
        <LogoutClientButton
          className="flex min-h-[48px] w-full items-center justify-center rounded-full border border-black/10 bg-white px-3 text-sm font-medium text-[rgb(var(--lp-fg))] transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Logg ut"
        />
      </div>
    </section>
  );
}
