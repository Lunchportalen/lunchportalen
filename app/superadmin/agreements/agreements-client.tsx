"use client";

import { useMemo, useState, useTransition } from "react";

type AgreementRow = {
  id: string;
  company_id: string;
  company_name: string;
  location_id: string | null;
  status: string;
  tier: string;
  delivery_days: string[];
  starts_at: string | null;
  ends_at: string | null;
  slot_start: string | null;
  slot_end: string | null;
  binding_months: number | null;
  notice_months: number | null;
  price_per_employee: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type Initial =
  | { ok: true; agreements: AgreementRow[] }
  | { ok: false; message?: string; agreements: AgreementRow[] };

type ApiEnvelope<T> = {
  ok?: boolean;
  rid?: string;
  message?: string;
  status?: number;
  error?: string | { code?: string };
  data?: T;
};

type CreateData = {
  agreementId?: string;
  status?: string;
  message?: string;
};

type ListData = {
  agreements?: AgreementRow[];
};

type ApproveData = {
  agreementId?: string;
  companyId?: string;
  status?: string;
  receipt?: string;
  message?: string;
};

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function statusLabel(status: string) {
  const s = safeStr(status).toUpperCase();
  if (s === "PENDING") return "Venter";
  if (s === "ACTIVE") return "Aktiv";
  return "Avsluttet";
}

function formatTs(v: string | null) {
  if (!v) return "-";
  return v.replace("T", " ").replace("Z", "");
}

function toPrice(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export default function AgreementsClient({ initial }: { initial: Initial }) {
  const [rows, setRows] = useState<AgreementRow[]>(initial.agreements ?? []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | "PENDING" | "ACTIVE" | "ENDED">("ALL");

  const [companyId, setCompanyId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [tier, setTier] = useState<"BASIS" | "LUXUS">("BASIS");
  const [startsAt, setStartsAt] = useState("");
  const [slotStart, setSlotStart] = useState("11:00");
  const [slotEnd, setSlotEnd] = useState("13:00");
  const [bindingMonths, setBindingMonths] = useState("12");
  const [noticeMonths, setNoticeMonths] = useState("3");
  const [pricePerEmployee, setPricePerEmployee] = useState("90");
  const [days, setDays] = useState<string[]>([...WEEKDAYS]);

  const initialMessage = "message" in initial && typeof initial.message === "string" ? initial.message : "";
  const [msg, setMsg] = useState<string>(initial.ok ? "" : initialMessage);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      const s = safeStr(r.status).toUpperCase();
      const matchStatus =
        status === "ALL"
          ? true
          : status === "ENDED"
            ? s !== "PENDING" && s !== "ACTIVE"
            : s === status;

      const matchQ =
        !qq ||
        safeStr(r.company_name).toLowerCase().includes(qq) ||
        safeStr(r.company_id).toLowerCase().includes(qq) ||
        safeStr(r.id).toLowerCase().includes(qq);

      return matchStatus && matchQ;
    });
  }, [rows, q, status]);

  async function refresh() {
    setMsg("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/superadmin/agreements/list?limit=200", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiEnvelope<ListData> | null;

        if (!res.ok || !json?.ok) {
          setMsg(json?.message || "Kunne ikke hente avtaler.");
          return;
        }

        setRows(Array.isArray(json.data?.agreements) ? json.data!.agreements! : []);
      } catch {
        setMsg("Kunne ikke hente avtaler.");
      }
    });
  }

  function toggleDay(day: string) {
    setDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      return [...prev, day];
    });
  }

  async function createPending() {
    setMsg("");

    if (!safeStr(companyId)) {
      setMsg("Firma må fylles ut.");
      return;
    }
    if (!startsAt) {
      setMsg("Startdato må fylles ut.");
      return;
    }
    if (days.length === 0) {
      setMsg("Velg minst én leveringsdag.");
      return;
    }

    const price = toPrice(pricePerEmployee);
    if (!Number.isFinite(price) || price <= 0) {
      setMsg("Pris per ansatt må være større enn 0.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/superadmin/agreements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            company_id: safeStr(companyId),
            location_id: safeStr(locationId) || null,
            tier,
            delivery_days: days,
            slot_start: slotStart,
            slot_end: slotEnd,
            starts_at: startsAt,
            binding_months: Number(bindingMonths || 12),
            notice_months: Number(noticeMonths || 3),
            price_per_employee: price,
          }),
        });

        const json = (await res.json().catch(() => null)) as ApiEnvelope<CreateData> | null;
        if (!res.ok || !json?.ok) {
          setMsg(json?.message || "Kunne ikke opprette avtale.");
          return;
        }

        setMsg(json.data?.message || "Avtale opprettet som Venter.");
        await refresh();
      } catch {
        setMsg("Kunne ikke opprette avtale.");
      }
    });
  }

  async function approve(agreementId: string) {
    setMsg("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/superadmin/agreements/${agreementId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        const json = (await res.json().catch(() => null)) as ApiEnvelope<ApproveData> | null;
        if (!res.ok || !json?.ok) {
          if (res.status === 409) {
            setMsg("Det finnes allerede en aktiv avtale for dette firmaet.");
            return;
          }
          setMsg(json?.message || "Kunne ikke godkjenne avtalen.");
          return;
        }

        setMsg(json.data?.message || "Avtalen er godkjent");
        await refresh();
      } catch {
        setMsg("Kunne ikke godkjenne avtalen.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="lp-card lp-card--elevated">
        <div className="lp-card-pad space-y-4">
          <h2 className="text-base font-semibold text-neutral-900">Opprett ny avtale</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Firma-id
              <input
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              />
            </label>

            <label className="text-sm">
              Lokasjon-id (valgfri)
              <input
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              />
            </label>

            <label className="text-sm">
              Nivå
              <select
                value={tier}
                onChange={(e) => setTier((e.target.value as "BASIS" | "LUXUS") || "BASIS")}
                className="mt-1 h-10 w-full rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              >
                <option value="BASIS">BASIS</option>
                <option value="LUXUS">LUXUS</option>
              </select>
            </label>

            <label className="text-sm">
              Startdato
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              />
            </label>

            <label className="text-sm">
              Leveringsvindu fra
              <input
                type="time"
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              />
            </label>

            <label className="text-sm">
              Leveringsvindu til
              <input
                type="time"
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              />
            </label>

            <label className="text-sm">
              Binding (måneder)
              <input
                type="number"
                min={1}
                value={bindingMonths}
                onChange={(e) => setBindingMonths(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              />
            </label>

            <label className="text-sm">
              Oppsigelse (måneder)
              <input
                type="number"
                min={0}
                value={noticeMonths}
                onChange={(e) => setNoticeMonths(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              />
            </label>

            <label className="text-sm md:col-span-2">
              Pris per ansatt
              <input
                value={pricePerEmployee}
                onChange={(e) => setPricePerEmployee(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              />
            </label>
          </div>

          <div>
            <div className="text-sm font-medium">Leveringsdager</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const active = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={[
                      "rounded-full px-3 py-1 text-sm ring-1",
                      active ? "bg-black text-white ring-black" : "bg-white/70 ring-black/10",
                    ].join(" ")}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <button onClick={createPending} disabled={isPending} className="lp-btn lp-btn--primary">
              Opprett som Venter
            </button>
          </div>
        </div>
      </section>

      <section className="lp-card lp-card--elevated">
        <div className="lp-card-pad space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Avtaler</div>
              <div className="mt-1 text-sm lp-muted">{isPending ? "Oppdaterer..." : `${filtered.length} avtaler vises`}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Søk firma eller avtale"
                className="h-10 w-[240px] rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              />

              <select
                value={status}
                onChange={(e) => setStatus((e.target.value as "ALL" | "PENDING" | "ACTIVE" | "ENDED") || "ALL")}
                className="h-10 rounded-xl px-3 text-sm ring-1 ring-black/10 bg-white/70"
              >
                <option value="ALL">Alle</option>
                <option value="PENDING">Venter</option>
                <option value="ACTIVE">Aktiv</option>
                <option value="ENDED">Avsluttet</option>
              </select>

              <button onClick={refresh} disabled={isPending} className="lp-btn lp-btn--secondary">
                Oppdater
              </button>
            </div>
          </div>

          {msg ? (
            <div className="rounded-2xl bg-rose-50 text-rose-900 ring-1 ring-rose-200 p-3 text-sm">{msg}</div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-neutral-600">
                  <th className="py-2 pr-3">Firma</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Nivå</th>
                  <th className="py-2 pr-3">Dager</th>
                  <th className="py-2 pr-3">Vindu</th>
                  <th className="py-2 pr-3">Start</th>
                  <th className="py-2 pr-3">Pris</th>
                  <th className="py-2 pr-3">Oppdatert</th>
                  <th className="py-2 pr-3">Handling</th>
                </tr>
              </thead>

              <tbody className="align-top">
                {filtered.map((r) => {
                  const label = statusLabel(r.status);
                  const canApprove = safeStr(r.status).toUpperCase() === "PENDING";

                  return (
                    <tr key={r.id} className="border-t border-black/5">
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-neutral-900">{r.company_name}</div>
                        <div className="mt-1 text-xs lp-muted">company_id: {r.company_id}</div>
                        <div className="mt-1 text-xs lp-muted">agreement_id: {r.id}</div>
                      </td>

                      <td className="py-3 pr-3">
                        <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-black/10 bg-white/70">
                          {label}
                        </span>
                      </td>

                      <td className="py-3 pr-3">{safeStr(r.tier) || "-"}</td>
                      <td className="py-3 pr-3">{Array.isArray(r.delivery_days) && r.delivery_days.length > 0 ? r.delivery_days.join(", ") : "-"}</td>
                      <td className="py-3 pr-3">{r.slot_start && r.slot_end ? `${r.slot_start}-${r.slot_end}` : "-"}</td>
                      <td className="py-3 pr-3">{r.starts_at ?? "-"}</td>
                      <td className="py-3 pr-3">{r.price_per_employee ?? "-"}</td>
                      <td className="py-3 pr-3">{formatTs(r.updated_at)}</td>

                      <td className="py-3 pr-3">
                        {canApprove ? (
                          <button onClick={() => approve(r.id)} disabled={isPending} className="lp-btn lp-btn--primary">
                            Godkjenn
                          </button>
                        ) : (
                          <span className="text-xs lp-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 text-sm lp-muted">
                      Ingen treff.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}



