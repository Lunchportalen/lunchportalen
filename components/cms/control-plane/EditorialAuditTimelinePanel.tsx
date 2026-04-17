"use client";



import { useEffect, useState } from "react";



type AuditRow = {

  id: string;

  page_id: string | null;

  action: string;

  actor_email: string | null;

  created_at: string | null;

};



type AuditJson = {

  ok?: boolean;

  message?: string;

  data?: {

    items?: AuditRow[];

    degraded?: boolean;

    reason?: string;

    detail?: string;

    source?: string;

  };

};



/**

 * U20 — Siste hendelser fra Postgres `content_audit_log` (kildemerket — ikke full plattformhistorikk).

 * U30 — Tåler degradert modus når tabell mangler (200 + degraded), ikke bare 500.

 */

export function EditorialAuditTimelinePanel() {

  const [items, setItems] = useState<AuditRow[] | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [degraded, setDegraded] = useState<{ reason?: string } | null>(null);



  useEffect(() => {

    let cancelled = false;

    (async () => {

      try {

        const res = await fetch("/api/backoffice/content/audit-log?limit=12", {

          credentials: "include",

          cache: "no-store",

        });

        const json = (await res.json()) as AuditJson;

        if (cancelled) return;



        if (!res.ok || json?.ok === false) {

          setError(json?.message ?? `Kunne ikke laste audit (HTTP ${res.status}).`);

          setItems([]);

          setDegraded(null);

          return;

        }



        const data = json.data;

        if (data?.degraded) {

          setDegraded({ reason: data.reason });

          setItems([]);

          setError(null);

          return;

        }



        setItems(Array.isArray(data?.items) ? data.items : []);

        setError(null);

        setDegraded(null);

      } catch {

        if (!cancelled) {

          setError("Kunne ikke laste audit.");

          setItems([]);

          setDegraded(null);

        }

      }

    })();

    return () => {

      cancelled = true;

    };

  }, []);



  if (degraded) {

    return (

      <div

        className="mt-2 rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-3 text-[12px] leading-snug text-amber-950"

        role="status"

      >

        <p className="font-semibold">Audit-logg er midlertidig utilgjengelig</p>

        <p className="mt-1 text-amber-900/95">

          Postgres-tabellen <span className="font-mono text-[11px]">content_audit_log</span> finnes ikke eller er ikke

          migrert i dette miljøet. Ingen data er skjult — kilden er rett og slett ikke til stede.

        </p>

        {degraded.reason ? (

          <p className="mt-1 font-mono text-[10px] text-amber-800/90">{degraded.reason}</p>

        ) : null}

      </div>

    );

  }



  if (error && (!items || items.length === 0)) {

    return (

      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-900">

        {error}{" "}

        <span className="text-amber-800/90">(Kilde: Postgres content_audit_log — superadmin-tilgang påkrevd.)</span>

      </div>

    );

  }



  if (!items || items.length === 0) {

    return (

      <p className="mt-2 text-[11px] text-slate-500">

        Ingen audit-hendelser i vinduet (eller tom logg).{" "}

        <span className="font-medium text-slate-700">Kilde: Postgres · content_audit_log</span>

      </p>

    );

  }



  return (

    <div className="mt-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm">

      <div className="flex flex-wrap items-baseline justify-between gap-2">

        <p className="text-[11px] font-semibold text-slate-900">Siste hendelser (Postgres audit)</p>

        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-slate-600">

          Kilde · content_audit_log

        </span>

      </div>

      <ul className="mt-2 divide-y divide-slate-100">

        {items.map((row) => (

          <li key={row.id} className="flex flex-wrap gap-x-3 gap-y-1 py-1.5 text-[11px] text-slate-700">

            <time className="shrink-0 text-slate-500" dateTime={row.created_at ?? undefined}>

              {row.created_at?.replace("T", " ").slice(0, 19) ?? "—"}

            </time>

            <span className="font-mono text-[10px] font-semibold uppercase text-slate-800">{row.action}</span>

            {row.page_id ? (

              <a

                className="truncate font-medium text-slate-900 underline underline-offset-2"

                href={`/backoffice/content/${row.page_id}`}

              >

                side

              </a>

            ) : (

              <span className="text-slate-500">—</span>

            )}

            <span className="min-w-0 truncate text-slate-600">{row.actor_email ?? "—"}</span>

          </li>

        ))}

      </ul>

      <p className="mt-2 text-[10px] leading-snug text-slate-500">

        Dette er <strong className="font-medium text-slate-700">ikke</strong> Sanity-historikk eller operativ uke-logg — se

        spor B/C over.

      </p>

    </div>

  );

}

