// components/auth/LogoutButton.tsx
"use client";

import { useTransition } from "react";

type Props = {
  variant?: "ghost" | "primary" | "secondary";
  className?: string;
};

export default function LogoutButton({
  variant = "ghost",
  className,
}: Props) {
  const [isPending, startTransition] = useTransition();

  function onLogout() {
    if (isPending) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          redirect: "follow",
          cache: "no-store",
        });

        // Hvis fetch fulgte redirect (303 → /login)
        if (res.redirected && res.url) {
          window.location.href = res.url;
          return;
        }

        // Fallback – alltid trygt
        window.location.href = "/login";
      } catch {
        // Fail-closed
        window.location.href = "/login";
      }
    });
  }

  const base =
    "lp-btn lp-btn--sm lp-motion-btn disabled:opacity-60 disabled:cursor-not-allowed";

  const variantClass =
    variant === "primary"
      ? "lp-btn--primary"
      : variant === "secondary"
      ? "lp-btn--secondary"
      : "lp-btn--ghost";

  return (
    <button
      type="button"
      data-variant={variant}
      className={className ?? `${base} ${variantClass}`}
      disabled={isPending}
      onClick={onLogout}
      aria-busy={isPending}
      title={isPending ? "Logger ut…" : "Logg ut"}
    >
      {isPending ? "Logger ut…" : "Logg ut"}
    </button>
  );
}
