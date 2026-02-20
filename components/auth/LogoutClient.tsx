"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type LogoutState =
  | { status: "loading" }
  | { status: "done" }
  | { status: "error"; message: string; rid: string };

function timeoutFetch(url: string, ms = 8000) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  return {
    run: fetch(url, { method: "POST", cache: "no-store", signal: ac.signal }),
    cancel: () => clearTimeout(id),
  };
}

async function performLogoutRedirect() {
  try {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      redirect: "follow",
      cache: "no-store",
    });

    if (res.redirected && res.url) {
      window.location.href = res.url;
      return;
    }

    window.location.href = "/login";
  } catch {
    window.location.href = "/login";
  }
}

export function LogoutClientButton({ className }: { className?: string }) {
  const [isPending, startTransition] = useTransition();

  function onLogout() {
    if (isPending) return;

    startTransition(async () => {
      await performLogoutRedirect();
    });
  }

  return (
    <button
      type="button"
      className={className ?? "lp-btn lp-btn--ghost lp-btn--sm"}
      disabled={isPending}
      onClick={onLogout}
      aria-busy={isPending}
      title={isPending ? "Logger ut..." : "Logg ut"}
    >
      {isPending ? "Logger ut..." : "Logg ut"}
    </button>
  );
}

export default function LogoutClient() {
  const [state, setState] = useState<LogoutState>({ status: "loading" });

  const errLabel = useMemo(() => {
    if (state.status !== "error") return null;
    return `${state.message} (RID: ${state.rid || "—"})`;
  }, [state]);

  async function runLogout() {
    setState({ status: "loading" });
    try {
      const { run, cancel } = timeoutFetch("/api/auth/logout", 8000);
      const res = await run;
      cancel();
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setState({
          status: "error",
          message: json?.message ?? "Kunne ikke logge ut.",
          rid: String(json?.rid ?? ""),
        });
        return;
      }
      setState({ status: "done" });
    } catch {
      setState({ status: "error", message: "Kunne ikke logge ut.", rid: "" });
    }
  }

  useEffect(() => {
    void runLogout();
  }, []);

  if (state.status === "loading") {
    return <div className="text-sm text-[rgb(var(--lp-muted))]">Logger ut...</div>;
  }

  if (state.status === "done") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
          Du er logget ut.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="lp-btn--stable lp-neon-focus lp-neon-glow-hover">
            <Link href="/login">Til login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
        {errLabel || "Kunne ikke logge ut. Prøv igjen."}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="lp-btn--stable lp-neon-focus lp-neon-glow-hover">
          <Link href="/login">Til login</Link>
        </Button>
        <Button variant="secondary" onClick={runLogout}>
          Prøv igjen
        </Button>
      </div>
    </div>
  );
}
