// app/superadmin/invoices/[runId]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import type React from "react";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";

import InvoiceRunDetailClient from "@/components/superadmin/InvoiceRunDetailClient";
import { supabaseServer } from "@/lib/supabase/server";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

async function getBaseUrl() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  const env = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");
  if (!host) return env;

  return `${proto}://${host}`.replace(/\/$/, "");
}

async function getRun(runId: string) {
  const c = await cookies();
  const base = await getBaseUrl();

  const cookieHeader = c
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const res = await fetch(`${base}/api/superadmin/invoices/runs/${encodeURIComponent(runId)}`, {
    cache: "no-store",
    headers: {
      // ✅ viktig i Next 15 server fetch: viderefør cookies til API route
      cookie: cookieHeader,
    },
  }).catch(() => null);

  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

// ✅ Next 15: params kan være Promise
export default async function InvoiceRunDetailPage(props: {
  params: { runId: string } | Promise<{ runId: string }>;
}) {
  const p = await props.params;
  const runId = safeStr(p?.runId);

  if (!runId) notFound();

  // -----------------------------
  // Superadmin gate (FASET)
  // -----------------------------
  const sb = await supabaseServer();

  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect(`/login?next=/superadmin/invoices/${encodeURIComponent(runId)}`);
  }

  if (!(await isSuperadminProfile(user.id))) {
    redirect("/login?next=/superadmin");
  }

  // -----------------------------
  // Load run (via API)
  // -----------------------------
  const data = await getRun(runId);

  if (!data?.ok) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-8 lp-select-text">
        <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-lg font-semibold text-[rgb(var(--lp-text))]">Fant ikke fakturakjøring</div>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Sjekk runId, eller at du er innlogget som superadmin.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl bg-white/60 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
            href="/superadmin/invoices"
          >
            Tilbake
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 lp-select-text">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">
            {data.run.period_from} → {data.run.period_to}
          </h1>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{data.run.id}</div>
        </div>

        <Link
          href="/superadmin/invoices"
          className="rounded-xl bg-white/60 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
        >
          Tilbake
        </Link>
      </div>

      <InvoiceRunDetailClient initialRun={data.run} initialRows={data.rows} initialTotals={data.totals} />
    </main>
  );
}
