// app/superadmin/audit/[id]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { cookies, headers } from "next/headers";
import type React from "react";
import { formatDateTimeSecondsNO } from "@/lib/date/format";

type AuditEvent = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string | null;
  detail: any | null;
};

type ApiOk = { ok: true; rid?: string; audit: AuditEvent };
type ApiErr = { ok: false; rid?: string; error: string; message?: string; detail?: any };
type ApiRes = ApiOk | ApiErr;

function safeText(v: any) {
  return String(v ?? "").trim();
}

function fmtTs(ts: string) {
  return formatDateTimeSecondsNO(ts);
}

async function getBaseUrl() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  const env = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");
  if (!host) return env;

  return `${proto}://${host}`.replace(/\/$/, "");
}

async function getAudit(id: string): Promise<ApiRes> {
  const base = await getBaseUrl();
  const url = `${base}/api/superadmin/audit/${encodeURIComponent(id)}`;

  const c = await cookies();

  const cookieHeader = c
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const r = await fetch(url, {
    cache: "no-store",
    headers: {
      // ✅ viktig: viderefør cookies så /api kan autentisere
      cookie: cookieHeader,
    },
  });

  let body: any = null;
  try {
    body = await r.json();
  } catch {
    body = null;
  }

  if (!r.ok) {
    const rid = body?.rid;
    const msg = body?.message || body?.error || `HTTP ${r.status}`;
    return { ok: false, rid, error: "HTTP_ERROR", message: msg, detail: body?.detail ?? body };
  }

  return body as ApiRes;
}

export default async function AuditDetailPage({ params }: { params: { id: string } }) {
  const id = safeText(params?.id);
  const data = id
    ? await getAudit(id)
    : ({ ok: false, error: "BAD_REQUEST", message: "Mangler id." } as ApiErr);

  if (!data || (data as any).ok !== true) {
    const err = data as ApiErr | null;

    return (
      <main className="lp-select-text mx-auto grid w-full max-w-6xl gap-4 p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold">Audit detail</h1>
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Detaljvisning av audit-hendelse.</p>
          </div>

          <Link
            href="/superadmin/audit"
            className="text-sm font-semibold text-[rgb(var(--lp-text))] hover:underline"
            aria-label="Tilbake til audit"
          >
            ← Tilbake
          </Link>
        </header>

        <section className="lp-card grid gap-2 p-4">
          <div className="text-sm font-semibold text-[rgb(var(--lp-crit-tx))]">Fant ikke audit-hendelsen.</div>
          <div className="text-sm text-[rgb(var(--lp-muted))]">
            {err?.message ? err.message : "Audit-hendelsen finnes ikke, eller du mangler tilgang."}
          </div>

          <div className="lp-mono mt-2 text-xs text-[rgb(var(--lp-muted))]">
            ID: {id || "—"} {err?.rid ? ` • rid: ${err.rid}` : ""}
          </div>

          {err?.detail ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold">Tekniske detaljer</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-[rgba(var(--lp-text),0.04)] p-3 text-xs text-[rgb(var(--lp-text))]">
                {JSON.stringify(err.detail, null, 2)}
              </pre>
            </details>
          ) : null}
        </section>
      </main>
    );
  }

  const a = (data as ApiOk).audit;

  return (
    <main className="lp-select-text mx-auto grid w-full max-w-6xl gap-4 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Audit detail</h1>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Revisjonslogg for Superadmin. Felt under er “read-only”.</p>
        </div>

        <Link
          href="/superadmin/audit"
          className="text-sm font-semibold text-[rgb(var(--lp-text))] hover:underline"
          aria-label="Tilbake til audit"
        >
          ← Tilbake
        </Link>
      </header>

      <section className="lp-card grid gap-2 p-4">
        <div className="grid gap-2 text-sm">
          <div>
            <b>ID:</b> <span className="lp-mono text-xs">{a.id}</span>
          </div>
          <div>
            <b>Tid:</b> {fmtTs(a.created_at)}
          </div>
          <div>
            <b>Actor:</b> {a.actor_email ?? "—"} <span className="text-[rgb(var(--lp-muted))]">({a.actor_role ?? "—"})</span>
          </div>
          <div>
            <b>Action:</b> <span className="lp-mono text-xs">{a.action}</span>
          </div>
          <div>
            <b>Entity:</b> {a.entity_type} <span className="text-[rgb(var(--lp-muted))]">•</span>{" "}
            <span className="lp-mono text-xs">{a.entity_id}</span>
          </div>
        </div>
      </section>

      <section className="lp-card p-4">
        <b>Summary</b>
        <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{a.summary ?? "—"}</div>
      </section>

      <section className="lp-card p-4">
        <b>Detail (JSON)</b>
        <pre className="lp-mono mt-2 max-h-[420px] overflow-auto rounded-xl bg-[rgba(var(--lp-text),0.04)] p-3 text-xs leading-snug">
          {JSON.stringify(a.detail ?? null, null, 2)}
        </pre>
      </section>
    </main>
  );
}
