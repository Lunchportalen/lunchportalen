import "server-only";

type AgreementSnapshot = {
  id: string;
  status: string;
  tier: string | null;
  delivery_days?: string[] | null;
  days?: string[] | null;
  starts_at: string | null;
  slot_start: string | null;
  slot_end: string | null;
  updated_at: string | null;
} | null;

type Props = {
  companyId: string;
  initialAgreement: AgreementSnapshot;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeTier(raw: unknown): "BASIS" | "LUXUS" | null {
  const s = safeStr(raw).toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s;
  return null;
}

function normalizeDays(raw: unknown): string[] {
  const src = Array.isArray(raw) ? raw : [];
  return src
    .map((x) => safeStr(x).toUpperCase())
    .filter((x) => x === "MON" || x === "TUE" || x === "WED" || x === "THU" || x === "FRI");
}

function dayLabel(day: string) {
  if (day === "MON") return "Man";
  if (day === "TUE") return "Tir";
  if (day === "WED") return "Ons";
  if (day === "THU") return "Tor";
  if (day === "FRI") return "Fre";
  return day;
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "PENDING") return "bg-amber-50 text-amber-900 ring-amber-200";
  if (status === "TERMINATED") return "bg-rose-50 text-rose-900 ring-rose-200";
  return "bg-neutral-50 text-neutral-800 ring-black/10";
}

export default function AgreementCard({ companyId, initialAgreement }: Props) {
  void companyId;

  if (!initialAgreement) {
    return <div className="text-sm text-[rgb(var(--lp-muted))]">Ingen avtale registrert.</div>;
  }

  const delivery_days = normalizeDays(initialAgreement.delivery_days ?? initialAgreement.days ?? []);
  const tier = normalizeTier(initialAgreement.tier ?? null);
  const slot_start = safeStr(initialAgreement.slot_start ?? null) || null;
  const slot_end = safeStr(initialAgreement.slot_end ?? null) || null;
  const starts_at = safeStr(initialAgreement.starts_at ?? null) || null;
  const status = safeStr(initialAgreement.status ?? null).toUpperCase() || "UKJENT";

  return (
    <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold">Avtale</div>
        <span className={["inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1", statusClass(status)].join(" ")}>
          {status}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Tier</div>
          <div className="font-medium">{tier === "LUXUS" ? "LUXUS" : tier === "BASIS" ? "BASIS" : "Ikke satt"}</div>
        </div>
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Startdato</div>
          <div className="font-medium">{starts_at ?? "Ikke satt"}</div>
        </div>
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Leveringsdager</div>
          <div className="font-medium">{delivery_days.length ? delivery_days.map(dayLabel).join(", ") : "Ikke satt"}</div>
        </div>
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Leveringsvindu</div>
          <div className="font-medium">{slot_start && slot_end ? `${slot_start}-${slot_end}` : "Ikke satt"}</div>
        </div>
      </div>
    </div>
  );
}
