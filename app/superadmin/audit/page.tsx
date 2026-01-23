// app/superadmin/audit/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import AuditFeed from "@/components/audit/AuditFeed";
import { redirect } from "next/navigation";

type SP = Record<string, string | string[] | undefined>;

function first(sp: SP, key: string) {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function hasAnyQuery(sp: SP) {
  return Object.keys(sp || {}).some((k) => {
    const v = sp[k];
    if (Array.isArray(v)) return v.length > 0 && String(v[0] ?? "").trim().length > 0;
    return String(v ?? "").trim().length > 0;
  });
}

function clampLimit(v: any, fallback = 200) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(500, Math.floor(n)));
}

export default function SuperadminAuditPage({ searchParams }: { searchParams?: SP }) {
  const sp = searchParams ?? {};

  // Default: stabil URL (bookmarks/back-button)
  if (!hasAnyQuery(sp)) {
    redirect("/superadmin/audit?limit=200");
  }

  const initialLimit = clampLimit(first(sp, "limit"), 200);

  return (
    <main className="lp-select-text" style={{ padding: 20, display: "grid", gap: 14 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Audit</h1>
          <p style={{ margin: "6px 0 0 0", opacity: 0.75 }}>
            Revisjonslogg for Superadmin. Klikk en rad for detaljer.
          </p>
        </div>
      </header>

      <section>
        <AuditFeed initialLimit={initialLimit} />
      </section>
    </main>
  );
}
