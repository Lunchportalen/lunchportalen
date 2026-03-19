// app/superadmin/billing/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);

  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 13);
  const from = fromDate.toISOString().slice(0, 10);

  const href = `/api/superadmin/billing/export?from=${from}&to=${to}`;

  return (
    <main className="lp-select-text mx-auto grid w-full max-w-4xl gap-4 p-4">
      <header>
        <h1 className="text-[22px] font-semibold">Fakturagrunnlag (CSV)</h1>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
          Standard: siste 14 dager. Du kan endre perioden ved å justere query i URL.
        </p>
      </header>

      <section>
        <a
          href={href}
          className="inline-flex items-center rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-4 py-3 text-sm font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
        >
          Last ned CSV (14 dager)
        </a>
      </section>

      <section className="lp-mono mt-2 break-all text-xs text-[rgb(var(--lp-muted))]">{href}</section>
    </main>
  );
}
