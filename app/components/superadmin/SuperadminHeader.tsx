"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type PendingCompany = {
  id: string;
  name: string | null;
  orgnr: string | null;
  status: string;
  created_at: string;
};

function fmt(dt: string) {
  try {
    const d = new Date(dt);
    return d.toLocaleString("nb-NO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return dt;
  }
}

export default function SuperadminHeader() {
  const [pending, setPending] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<PendingCompany[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const timerRef = useRef<number | null>(null);

  async function loadCount() {
    const res = await fetch("/api/superadmin/companies/pending-count", { cache: "no-store" }).catch(() => null);
    if (!res || !res.ok) return;
    const json = await res.json().catch(() => null);
    if (json?.ok) setPending(Number(json.pending ?? 0));
  }

  async function loadList() {
    setLoadingList(true);
    try {
      const res = await fetch("/api/superadmin/companies/pending", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) setList(json.companies ?? []);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadCount();

    // Polling: stabilt og enkelt
    timerRef.current = window.setInterval(loadCount, 20_000);

    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-pendingbell='1']")) setOpen(false);
    }
    document.addEventListener("click", onDocClick);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      document.removeEventListener("click", onDocClick);
    };
  }, []);

  useEffect(() => {
    if (open) loadList();
  }, [open]);

  const badge = useMemo(() => {
    if (!pending) return null;
    const text = pending > 99 ? "99+" : String(pending);
    return (
      <span className="absolute -top-1 -right-1 rounded-full bg-black text-white text-[10px] px-1.5 py-0.5 ring-2 ring-white">
        {text}
      </span>
    );
  }, [pending]);

  return (
    <header className="sticky top-0 z-40 bg-[rgb(var(--lp-bg))]/85 backdrop-blur border-b border-[rgb(var(--lp-border))]">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/superadmin" className="font-semibold tracking-tight">
            Superadmin
          </Link>
          <nav className="hidden md:flex items-center gap-2 text-sm text-[rgb(var(--lp-muted))]">
            <Link className="hover:text-black" href="/superadmin?tab=firms">Firma</Link>
            <Link className="hover:text-black" href="/superadmin?tab=audit">Audit</Link>
            <Link className="hover:text-black" href="/superadmin?tab=system">System</Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Pending bell */}
          <div className="relative" data-pendingbell="1">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/70 ring-1 ring-[rgb(var(--lp-border))] hover:bg-white transition"
              aria-label="Pending firma"
              title="Pending firma"
            >
              {/* enkel “bjelle” uten ikonbibliotek */}
              <span className="text-lg leading-none">🔔</span>
              {badge}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-[360px] rounded-2xl bg-white shadow-lg ring-1 ring-black/10 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-[rgb(var(--lp-border))]">
                  <div>
                    <div className="font-semibold">Nye firmaregistreringer</div>
                    <div className="text-xs text-[rgb(var(--lp-muted))]">Status: Pending</div>
                  </div>
                  <Link
                    className="text-sm underline underline-offset-4"
                    href="/superadmin?tab=firms&status=pending"
                    onClick={() => setOpen(false)}
                  >
                    Åpne oversikt
                  </Link>
                </div>

                <div className="max-h-[360px] overflow-auto">
                  {loadingList ? (
                    <div className="p-4 text-sm text-[rgb(var(--lp-muted))]">Henter…</div>
                  ) : list.length ? (
                    <ul className="divide-y divide-[rgb(var(--lp-border))]">
                      {list.map((c) => (
                        <li key={c.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{c.name ?? "Ukjent navn"}</div>
                              <div className="text-xs text-[rgb(var(--lp-muted))]">
                                Orgnr: {c.orgnr ?? "—"} • {fmt(c.created_at)}
                              </div>
                            </div>
                            <Link
                              className="text-sm px-3 py-1.5 rounded-xl bg-black text-white"
                              href={`/superadmin/companies/${c.id}`}
                              onClick={() => setOpen(false)}
                            >
                              Behandle
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4 text-sm text-[rgb(var(--lp-muted))]">Ingen nye pending akkurat nå.</div>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-[rgb(var(--lp-border))] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => loadCount()}
                    className="text-sm px-3 py-2 rounded-xl bg-white ring-1 ring-[rgb(var(--lp-border))] hover:bg-[rgb(var(--lp-bg))] transition"
                  >
                    Oppdater
                  </button>
                  <span className="text-xs text-[rgb(var(--lp-muted))]">Auto-oppdaterer hvert 20. sekund</span>
                </div>
              </div>
            )}
          </div>

          {/* evt andre knapper */}
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-white/70 ring-1 ring-[rgb(var(--lp-border))] hover:bg-white transition text-sm"
          >
            Til forsiden
          </Link>
        </div>
      </div>
    </header>
  );
}
