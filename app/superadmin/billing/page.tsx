// app/superadmin/billing/page.tsx
export const dynamic = "force-dynamic";

export default function Page() {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);

  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 13);
  const from = fromDate.toISOString().slice(0, 10);

  const href = `/api/superadmin/billing/export?from=${from}&to=${to}`;

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Fakturagrunnlag (CSV)</h1>
      <p style={{ marginBottom: 14, opacity: 0.85 }}>
        Standard: siste 14 dager. (Du kan endre query manuelt i URL hvis du vil.)
      </p>

      <a
        href={href}
        style={{
          display: "inline-block",
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid #ddd",
          textDecoration: "none",
        }}
      >
        Last ned CSV (14 dager)
      </a>

      <div style={{ marginTop: 16, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, opacity: 0.8 }}>
        {href}
      </div>
    </div>
  );
}
