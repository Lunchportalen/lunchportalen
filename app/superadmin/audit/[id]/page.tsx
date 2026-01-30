// app/superadmin/audit/[id]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { cookies, headers } from "next/headers";
import type React from "react";

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
  try {
    return new Date(ts).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function monoStyle(size = 12): React.CSSProperties {
  return { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: size };
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

  const r = await fetch(url, {
    cache: "no-store",
    headers: {
      // ✅ viktig: viderefør cookies så /api kan autentisere
      cookie: c.toString(),
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
      <main className="lp-select-text" style={{ padding: 20, display: "grid", gap: 14, maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Audit detail</h1>
            <p style={{ margin: "6px 0 0 0", opacity: 0.75 }}>Detaljvisning av audit-hendelse.</p>
          </div>

          <Link href="/superadmin/audit" style={{ textDecoration: "none", opacity: 0.85 }} aria-label="Tilbake til audit">
            ← Tilbake
          </Link>
        </header>

        <section
          style={{
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.10)",
            background: "white",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 900, color: "crimson" }}>Fant ikke audit-hendelsen.</div>
          <div style={{ opacity: 0.85 }}>
            {err?.message ? err.message : "Audit-hendelsen finnes ikke, eller du mangler tilgang."}
          </div>

          <div style={{ marginTop: 8, ...monoStyle(12), opacity: 0.8 }}>
            ID: {id || "—"} {err?.rid ? ` • rid: ${err.rid}` : ""}
          </div>

          {err?.detail ? (
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: "pointer" }}>Tekniske detaljer</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 10 }}>{JSON.stringify(err.detail, null, 2)}</pre>
            </details>
          ) : null}
        </section>
      </main>
    );
  }

  const a = (data as ApiOk).audit;

  return (
    <main className="lp-select-text" style={{ padding: 20, display: "grid", gap: 14, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Audit detail</h1>
          <p style={{ margin: "6px 0 0 0", opacity: 0.75 }}>Revisjonslogg for Superadmin. Felt under er “read-only”.</p>
        </div>

        <Link href="/superadmin/audit" style={{ textDecoration: "none", opacity: 0.85 }} aria-label="Tilbake til audit">
          ← Tilbake
        </Link>
      </header>

      <section style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(0,0,0,0.10)", background: "white", display: "grid", gap: 8 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div>
            <b>ID:</b> <span style={monoStyle(12)}>{a.id}</span>
          </div>
          <div>
            <b>Tid:</b> {fmtTs(a.created_at)}
          </div>
          <div>
            <b>Actor:</b> {a.actor_email ?? "—"} <span style={{ opacity: 0.7 }}>({a.actor_role ?? "—"})</span>
          </div>
          <div>
            <b>Action:</b> <span style={monoStyle(12)}>{a.action}</span>
          </div>
          <div>
            <b>Entity:</b> {a.entity_type} <span style={{ opacity: 0.7 }}>•</span>{" "}
            <span style={monoStyle(12)}>{a.entity_id}</span>
          </div>
        </div>
      </section>

      <section style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(0,0,0,0.10)", background: "white" }}>
        <b>Summary</b>
        <div style={{ opacity: 0.85, marginTop: 6 }}>{a.summary ?? "—"}</div>
      </section>

      <section style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(0,0,0,0.10)", background: "white" }}>
        <b>Detail (JSON)</b>
        <pre
          style={{
            marginTop: 10,
            background: "rgba(0,0,0,0.04)",
            padding: 12,
            borderRadius: 12,
            overflow: "auto",
            lineHeight: 1.35,
            ...monoStyle(12),
          }}
        >
          {JSON.stringify(a.detail ?? null, null, 2)}
        </pre>
      </section>
    </main>
  );
}
