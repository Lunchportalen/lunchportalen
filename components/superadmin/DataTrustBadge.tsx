"use client";

export type DataTrustKind = "REAL" | "ESTIMATED" | "DEMO";

const labelNb: Record<DataTrustKind, string> = {
  REAL: "REAL",
  ESTIMATED: "ESTIMATED",
  DEMO: "DEMO",
};

/**
 * Datakilde-merking for superadmin — bruker eksisterende lp-chip + semantiske farger.
 * REAL = grønn, ESTIMATED = gul, DEMO = lilla (Tailwind, samme pill-form).
 */
export default function DataTrustBadge({ kind }: { kind: DataTrustKind }) {
  if (kind === "DEMO") {
    return (
      <span
        className="inline-flex min-h-[26px] items-center rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900"
        title="Demo-/seed-data"
      >
        {labelNb[kind]}
      </span>
    );
  }
  const cls = kind === "REAL" ? "lp-chip lp-chip-ok" : "lp-chip lp-chip-warn";
  return (
    <span className={`${cls} text-[10px] font-semibold uppercase tracking-wide`} title={kind === "REAL" ? "Database / målt" : "Beregnet / modellert"}>
      {labelNb[kind]}
    </span>
  );
}
