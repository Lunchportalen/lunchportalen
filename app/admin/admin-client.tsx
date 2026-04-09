"use client";

// STATUS: KEEP

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type ApiOk = {
  ok: true;
  locked: boolean;
  reason?: string;
  profile?: any;
  company?: any;
};

type ApiErr = {
  ok: false;
  error: string;
  message?: string;
  detail?: any;
};

type ApiRes = ApiOk | ApiErr;

function isApiErr(v: any): v is ApiErr {
  return v && typeof v === "object" && v.ok === false;
}

function isApiOk(v: any): v is ApiOk {
  return v && typeof v === "object" && v.ok === true;
}

export default function AdminGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiRes | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/admin/me", { cache: "no-store" });
        const json = (await res.json()) as any;

        if (!alive) return;

        // Hardening: sørg for at formen er forventet
        if (isApiOk(json) || isApiErr(json)) {
          setData(json);
        } else {
          setData({ ok: false, error: "bad_response", message: "Ugyldig respons fra server." });
        }
      } catch {
        if (!alive) return;
        setData({ ok: false, error: "network_error", message: "Kunne ikke hente admin-status." });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm text-[rgb(var(--lp-muted))]">Laster admin…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl bg-red-50 p-6 ring-1 ring-red-200">
        <div className="text-sm font-semibold text-red-900">Admin kunne ikke lastes</div>
        <div className="mt-2 text-sm text-red-900/90">Ukjent feil.</div>
      </div>
    );
  }

  if (isApiErr(data)) {
    return (
      <div className="rounded-3xl bg-red-50 p-6 ring-1 ring-red-200">
        <div className="text-sm font-semibold text-red-900">Admin kunne ikke lastes</div>
        <div className="mt-2 text-sm text-red-900/90">{data.message ?? data.error ?? "Ukjent feil."}</div>
      </div>
    );
  }

  // ✅ ENESTE gate:
  if (data.locked) {
    return (
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Blokkert</div>
        <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Admin er låst: <span className="font-medium">{data.reason ?? "ukjent"}</span>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-4 text-sm ring-1 ring-[rgb(var(--lp-border))]">
          <div className="font-semibold">Neste steg</div>
          <ul className="mt-2 list-disc pl-5 text-[rgb(var(--lp-muted))]">
            <li>Superadmin må knytte profilen til firma og lokasjon.</li>
            <li>Firma må være ACTIVE.</li>
          </ul>
        </div>
      </div>
    );
  }

  // ✅ UNLOCKED
  return <>{children}</>;
}
