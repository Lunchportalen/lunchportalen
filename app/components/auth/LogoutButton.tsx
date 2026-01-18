"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const LOGOUT_TIMEOUT_MS = 5000;

export default function LogoutButton({
  variant = "ghost",
}: {
  variant?: "ghost" | "solid";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ignore
      }

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Kunne ikke logge ut. Prøv igjen.");
      }

      // ✅ Hard redirect + refresh for å være 100% sikker på cookies/state
      router.push("/login");
      router.refresh();
    } catch (err: any) {
      // Enterprise: ikke spam alerts – men gi tydelig, rolig feedback
      console.error("[LogoutButton]", err?.message || err);
      router.push("/login");
      router.refresh();
    } finally {
      clearTimeout(t);
      setLoading(false);
    }
  }

  const base =
    "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70";
  const ghost =
    "border border-border bg-white px-4 py-2 text-text shadow-sm hover:bg-[rgb(var(--lp-bg)/1)]";
  const solid =
    "bg-[rgb(var(--lp-cta)/1)] px-4 py-2 text-white shadow-[0_14px_40px_-18px_rgba(0,0,0,0.45)] ring-1 ring-black/5 hover:brightness-[1.03] active:brightness-95";

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className={`${base} ${variant === "solid" ? solid : ghost}`}
      aria-label="Logg ut"
    >
      {loading ? "Logger ut…" : "Logg ut"}
    </button>
  );
}
