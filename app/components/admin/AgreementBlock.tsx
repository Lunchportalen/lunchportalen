// components/admin/AgreementBlock.tsx
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  normalizeAgreement,
  isAgreementInvalid,
  type AgreementNormalized,
  type DayKey,
} from "@/lib/agreements/normalizeAgreement";

type CompanyAgreementRow = {
  id: string;
  name: string | null;
  orgnr: string | null;
  status: string | null;
  agreement_json: any | null;
};

type LocationRow = {
  id: string;
  name: string | null;
  created_at: string | null;
};

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "—";
}

function money(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${Math.round(n)} kr`;
}

const DAY_ORDER: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Man" },
  { key: "tue", label: "Tir" },
  { key: "wed", label: "Ons" },
  { key: "thu", label: "Tor" },
  { key: "fri", label: "Fre" },
];

function tierKind(tier: string) {
  const t = String(tier ?? "").trim().toUpperCase();
  if (t === "LUXUS") return "luxus" as const;
  if (t === "BASIS") return "basis" as const;
  return "neutral" as const;
}

function TierPill({ tier, label }: { tier: string; label: string }) {
  const kind = tierKind(tier);
  const cls =
    kind === "luxus"
      ? "bg-neutral-900 text-white"
      : kind === "basis"
        ? "bg-white text-neutral-900 ring-1 ring-black/10"
        : "bg-white/70 text-neutral-900 ring-1 ring-black/10";

  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}

function summarize(agreement: AgreementNormalized) {
  const counts: Record<string, number> = {};
  for (const d of DAY_ORDER) {
    const tier = agreement.schedule[d.key].tier;
    counts[tier] = (counts[tier] ?? 0) + 1;
  }
  const parts = Object.entries(counts).map(([tier, n]) => {
    const meta = agreement.tiers[tier];
    const label = meta?.label ?? tier;
    const price = meta?.price;
    return `${n} dager ${label} (${money(price)})`;
  });
  return parts.join(" · ");
}

export default async function AgreementBlock(props: { companyId: string }) {
  const companyId = String(props.companyId ?? "").trim();
  const admin = supabaseAdmin();

  // Company
  const cRes = await admin
    .from("companies")
    .select("id, name, orgnr, status, agreement_json")
    .eq("id", companyId)
    .maybeSingle();

  const company = (cRes.data ?? null) as CompanyAgreementRow | null;

  // Locations (robust: only columns we know exist)
  const lRes = await admin
    .from("company_locations")
    .select("id, name, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const locations = (lRes.data ?? []) as LocationRow[];

  // If company fetch failed: minimal, clean error
  if (cRes.error || !company) {
    return (
      <div className="rounded-3xl bg-white/80 p-6 ring-1 ring-black/5 backdrop-blur">
        <div className="text-sm font-semibold text-neutral-900">Kunne ikke hente avtale</div>
        <div className="mt-1 text-sm text-neutral-600">{safeText(cRes.error?.message)}</div>
      </div>
    );
  }

  // Normalize agreement (NO guessing)
  const res = normalizeAgreement(company.agreement_json);

  // Minimal invalid state (still informative, but not “boxy”)
  if (isAgreementInvalid(res)) {
    return (
      <div className="rounded-3xl bg-white/80 p-6 ring-1 ring-black/5 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold tracking-wide text-neutral-600">Avtale</div>
            <div className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">Avtale er ugyldig</div>
            <div className="mt-2 text-sm text-neutral-600">
              Systemet kan ikke gjette. Avtalen må være komplett for å brukes i bestilling og faktura.
            </div>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
              {res.error}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-neutral-950 p-4 ring-1 ring-black/10">
          <div className="text-xs font-semibold text-white/80">agreement_json (diagnose)</div>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-white/85">
{JSON.stringify(company.agreement_json ?? null, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  const agreement = res;

  return (
    <div className="rounded-3xl bg-white/80 p-6 ring-1 ring-black/5 shadow-[0_12px_44px_-34px_rgba(0,0,0,.40)] backdrop-blur">
      {/* Header (minimal) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-neutral-600">Avtale · {safeText(company.name)}</div>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-neutral-900">Ukesplan</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Lesemodus. Dette er avtalen slik firmaet har registrert den — per dag.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-black/10">
            Cut-off: {agreement.cutoffTime}
          </span>
          <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-black/10">
            {agreement.timezone}
          </span>
        </div>
      </div>

      {/* Days list (NO boxes, only spacing) */}
      <div className="mt-6 divide-y divide-black/5 rounded-2xl bg-white/70 ring-1 ring-black/5">
        {DAY_ORDER.map((d) => {
          const s = agreement.schedule[d.key];
          const meta = agreement.tiers[s.tier];
          const label = meta?.label ?? s.tier;

          return (
            <div key={d.key} className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <div className="text-sm font-semibold text-neutral-900">{d.label}</div>
              <div className="flex items-center gap-3">
                <TierPill tier={s.tier} label={label} />
                <div className="text-base font-extrabold text-neutral-900">{money(s.price)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary line (no box) */}
      <div className="mt-4 text-sm font-semibold text-neutral-900">{summarize(agreement)}</div>
      <div className="mt-1 text-sm text-neutral-600">
        Binding: {agreement.commercial.bindingMonths} mnd · Oppsigelse: {agreement.commercial.noticeMonths} mnd
      </div>

      {/* Locations (lightweight) */}
      <div className="mt-6 border-t border-black/5 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Lokasjoner</div>
            <div className="mt-1 text-sm text-neutral-600">Oversikt. Endringer håndteres av superadmin.</div>
          </div>
          <div className="text-xs font-semibold text-neutral-500">
            Org.nr: {safeText(company.orgnr)} · Status: {safeText(company.status)}
          </div>
        </div>

        {lRes.error ? (
          <div className="mt-3 text-sm text-neutral-600">Kunne ikke hente lokasjoner: {safeText(lRes.error.message)}</div>
        ) : locations.length === 0 ? (
          <div className="mt-3 text-sm text-neutral-600">Ingen lokasjoner registrert.</div>
        ) : (
          <ul className="mt-3 space-y-2">
            {locations.map((loc) => (
              <li key={loc.id} className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-black/5">
                <span className="text-sm font-semibold text-neutral-900">{safeText(loc.name)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Fine print (minimal) */}
      <div className="mt-6 border-t border-black/5 pt-4 text-sm text-neutral-600">
        <ul className="list-disc space-y-1 pl-5">
          <li>Avtale og cut-off er systemets fasit. Det kan ikke overstyres manuelt.</li>
          <li>Hvis noe ikke stemmer, send en systemrapport — så kan drift rette opp riktig vei.</li>
        </ul>
      </div>
    </div>
  );
}
