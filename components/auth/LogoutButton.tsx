// components/auth/LogoutButton.tsx
"use client";

import { useState, useTransition } from "react";

import { LOGOUT_ERROR_MESSAGE, performLogoutRedirect } from "@/components/auth/LogoutClient";

type Props = {
  variant?: "ghost" | "primary" | "secondary";
  className?: string;
};

export default function LogoutButton({
  variant = "ghost",
  className,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onLogout() {
    if (isPending) return;

    startTransition(async () => {
      setError(null);
      const result = await performLogoutRedirect();
      if (!result.ok) {
        setError(LOGOUT_ERROR_MESSAGE);
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
    <div>
      <button
        type="button"
        data-variant={variant}
        className={className ?? `${base} ${variantClass}`}
        disabled={isPending}
        onClick={onLogout}
        aria-busy={isPending}
        aria-label="Logg ut"
        title={isPending ? "Logger ut…" : "Logg ut"}
      >
        {isPending ? "Logger ut…" : "Logg ut"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
