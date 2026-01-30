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
    <main className="lp-select-text" style={{ padding: 16, maxWidth: 900, margin: "0 auto", display: "grid", gap: 14 }}>
      <header>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          Fakturagrunnlag (CSV)
        </h1>
        <p style={{ opacity: 0.85 }}>
          Standard: siste 14 dager. Du kan endre perioden ved å justere query i URL.
        </p>
      </header>

      <section>
        <a
          href={href}
          style={{
            display: "inline-block",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Last ned CSV (14 dager)
        </a>
      </section>

      <section
        style={{
          marginTop: 8,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
          opacity: 0.75,
          wordBreak: "break-all",
        }}
      >
        {href}
      </section>
    </main>
  );
}
