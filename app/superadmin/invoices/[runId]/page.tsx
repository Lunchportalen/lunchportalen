import Link from "next/link";
import { cookies } from "next/headers";
import InvoiceRunDetailClient from "@/components/superadmin/InvoiceRunDetailClient";

export const dynamic = "force-dynamic";

async function getRun(runId: string) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");

  const res = await fetch(`/api/superadmin/invoices/runs/${runId}`, {
    cache: "no-store",
    headers: { cookie: cookieHeader },
  }).catch(() => null);

  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

// ✅ Next 15: params er async
export default async function InvoiceRunDetailPage(props: { params: Promise<{ runId: string }> }) {
  const { runId } = await props.params;

  const data = await getRun(runId);

  if (!data?.ok) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
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
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
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
