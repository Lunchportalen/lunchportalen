import "server-only";

import type { ContractOverview } from "@/lib/agreements/contractBindingCompute";
import type { AgreementDocumentOverview } from "@/lib/agreements/buildAgreementDocumentOverview";
import { formatDateNO, formatDateTimeNO } from "@/lib/date/format";
import { isIsoDate } from "@/lib/date/oslo";

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
  contractOverview?: ContractOverview | null;
  agreementDocuments?: AgreementDocumentOverview[];
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

function fmtIso(iso: string | null) {
  if (!iso) return "Ikke satt";
  if (!isIsoDate(iso)) return iso;
  return formatDateNO(iso);
}

function fmtCreated(iso: string | null) {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  if (isIsoDate(day)) {
    try {
      return iso.length > 10 ? formatDateTimeNO(iso) : formatDateNO(day);
    } catch {
      return iso;
    }
  }
  try {
    return formatDateTimeNO(iso);
  } catch {
    return iso;
  }
}

function fmtBindingMonths(n: number | null) {
  if (n === null) return "—";
  return `${n} mnd`;
}

function sourceLabel(s: AgreementDocumentOverview["source"]) {
  if (s === "agreement_pdf") return "PDF (lagring)";
  if (s === "terms_acceptance") return "Vilkårsaksept";
  return s;
}

export default function AgreementCard({ companyId, initialAgreement, contractOverview, agreementDocuments }: Props) {
  void companyId;

  const docs = Array.isArray(agreementDocuments) ? agreementDocuments : [];

  if (!contractOverview && !initialAgreement && docs.length === 0) {
    return <div className="text-sm text-[rgb(var(--lp-muted))]">Ingen avtale registrert.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {docs.length ? (
        <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Avtaledokumenter</div>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Fra operativt lag: vilkårsregistrering og ev. PDF-sti i agreement_json (samme kontrakt som ansatt-nedlasting).
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[280px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--lp-border))] text-xs text-[rgb(var(--lp-muted))]">
                  <th className="py-2 pr-3 font-medium">Tittel</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Kilde</th>
                  <th className="py-2 pr-3 font-medium">Opprettet / akseptert</th>
                  <th className="py-2 pr-3 font-medium">Koblinger</th>
                  <th className="py-2 font-medium">Sti</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={`${d.source}:${d.record_id ?? d.title}:${d.created_at ?? ""}`} className="border-b border-[rgb(var(--lp-border))]/60 align-top">
                    <td className="py-2 pr-3 font-medium">{d.title}</td>
                    <td className="py-2 pr-3">{d.document_type}</td>
                    <td className="py-2 pr-3">{sourceLabel(d.source)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{d.created_at ? fmtCreated(d.created_at) : "—"}</td>
                    <td className="py-2 pr-3 text-xs text-[rgb(var(--lp-muted))]">
                      {d.company_agreement_id ? <div>Ledger: {d.company_agreement_id}</div> : null}
                      {d.legacy_agreement_id ? <div>agreements: {d.legacy_agreement_id}</div> : null}
                      {!d.company_agreement_id && !d.legacy_agreement_id ? "—" : null}
                    </td>
                    <td className="py-2 font-mono text-xs break-all text-[rgb(var(--lp-muted))]">{d.storage_path ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {contractOverview ? (
        <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold">Kontraktoversikt</div>
            <span
              className={["inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1", statusClass(contractOverview.status)].join(
                " "
              )}
            >
              {contractOverview.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Operativt grunnlag (company_agreements). Referansedato: {contractOverview.reference_date} (Europe/Oslo).
          </p>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Startdato</div>
              <div className="font-medium">{fmtIso(contractOverview.start_date)}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Sluttdato (registrert)</div>
              <div className="font-medium">{fmtIso(contractOverview.end_date)}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Beregnet bindingsutløp</div>
              <div className="font-medium">{fmtIso(contractOverview.effective_binding_end_date)}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Gjenstående binding</div>
              <div className="font-medium">{fmtBindingMonths(contractOverview.binding_months_remaining)}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Bindingsperiode (måneder)</div>
              <div className="font-medium">{contractOverview.binding_months ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Oppsigelse (måneder)</div>
              <div className="font-medium">{contractOverview.notice_months ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Plan</div>
              <div className="font-medium">
                {contractOverview.plan_tier === "LUXUS"
                  ? "LUXUS"
                  : contractOverview.plan_tier === "BASIS"
                    ? "BASIS"
                    : contractOverview.plan_tier || "—"}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {initialAgreement ? (
        <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold">Meny / leveranse (agreements)</div>
            <span className={["inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1", statusClass(safeStr(initialAgreement.status).toUpperCase())].join(" ")}>
              {safeStr(initialAgreement.status ?? null).toUpperCase() || "UKJENT"}
            </span>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Tier</div>
              <div className="font-medium">
                {normalizeTier(initialAgreement.tier ?? null) === "LUXUS"
                  ? "LUXUS"
                  : normalizeTier(initialAgreement.tier ?? null) === "BASIS"
                    ? "BASIS"
                    : "Ikke satt"}
              </div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Startdato</div>
              <div className="font-medium">{safeStr(initialAgreement.starts_at ?? null) || "Ikke satt"}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Leveringsdager</div>
              <div className="font-medium">
                {normalizeDays(initialAgreement.delivery_days ?? initialAgreement.days ?? []).length
                  ? normalizeDays(initialAgreement.delivery_days ?? initialAgreement.days ?? []).map(dayLabel).join(", ")
                  : "Ikke satt"}
              </div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Leveringsvindu</div>
              <div className="font-medium">
                {safeStr(initialAgreement.slot_start ?? null) && safeStr(initialAgreement.slot_end ?? null)
                  ? `${safeStr(initialAgreement.slot_start)}-${safeStr(initialAgreement.slot_end)}`
                  : "Ikke satt"}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
