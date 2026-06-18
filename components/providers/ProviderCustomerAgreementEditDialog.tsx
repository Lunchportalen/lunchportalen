"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import type { DayKey } from "@/lib/agreements/normalize";
import type { ProviderAgreementReadModel } from "@/lib/providers/providerCustomerAgreementTypes";

type ApiErr = {
  ok: false;
  message?: string;
  error?: string;
  rid?: string;
};

const WEEKDAYS: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Mandag" },
  { key: "tue", label: "Tirsdag" },
  { key: "wed", label: "Onsdag" },
  { key: "thu", label: "Torsdag" },
  { key: "fri", label: "Fredag" },
];

const PLANS = [
  { value: "BASIS", label: "Basis" },
  { value: "LUXUS", label: "Luxus" },
  { value: "ENTERPRISE", label: "Enterprise" },
] as const;

async function readJsonSafe(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function parseApiMessage(body: ApiErr | null, fallback: string) {
  const message = safeStr(body?.message);
  if (message) {
    const rid = safeStr(body?.rid);
    return rid ? `${message} (RID: ${rid})` : message;
  }
  const rid = safeStr(body?.rid);
  return rid ? `${fallback} (RID: ${rid})` : fallback;
}

export default function ProviderCustomerAgreementEditDialog(props: {
  open: boolean;
  companyId: string;
  companyName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { open, companyId, companyName, onClose, onDone } = props;
  const apiUrl = `/api/provider/customers/${encodeURIComponent(companyId)}/agreement`;

  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<ProviderAgreementReadModel | null>(null);

  const [plan, setPlan] = useState("BASIS");
  const [deliveryDays, setDeliveryDays] = useState<DayKey[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [windowFrom, setWindowFrom] = useState("11:00");
  const [windowTo, setWindowTo] = useState("13:00");
  const [status, setStatus] = useState<"ACTIVE" | "PAUSED">("ACTIVE");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setLoaded(null);
    setLoading(true);

    void (async () => {
      const res = await fetch(apiUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const body = (await readJsonSafe(res)) as { ok?: boolean; data?: ProviderAgreementReadModel; rid?: string; message?: string } | null;
      setLoading(false);
      if (!res.ok || body?.ok !== true || !body.data) {
        setErr(parseApiMessage(body as ApiErr, "Kunne ikke laste avtale."));
        return;
      }
      const data = body.data;
      setLoaded(data);
      setPlan(data.plan ?? "BASIS");
      setDeliveryDays(data.deliveryDays.length > 0 ? data.deliveryDays : ["mon", "tue", "wed", "thu", "fri"]);
      setLocationName(data.location.name ?? "");
      setLocationAddress(data.location.address ?? "");
      setContactName(data.contact.name ?? "");
      setContactEmail(data.contact.email ?? "");
      setContactPhone(data.contact.phone ?? "");
      setWindowFrom(data.deliveryWindow.from ?? "11:00");
      setWindowTo(data.deliveryWindow.to ?? "13:00");
      setStatus(data.status === "PAUSED" ? "PAUSED" : "ACTIVE");
      setDeliveryNote(data.deliveryNote ?? "");
      setReason("");
    })();
  }, [open, companyId, apiUrl]);

  const canSubmit = useMemo(() => {
    return Boolean(loaded) && deliveryDays.length > 0 && !loading && !pending;
  }, [loaded, deliveryDays.length, loading, pending]);

  function toggleDay(key: DayKey) {
    setDeliveryDays((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((d) => d !== key);
        return next.length > 0 ? next : prev;
      }
      return [...prev, key].sort((a, b) => WEEKDAYS.findIndex((w) => w.key === a) - WEEKDAYS.findIndex((w) => w.key === b));
    });
  }

  function submit() {
    if (!loaded) return;
    setErr(null);
    startTransition(async () => {
      const payload: Record<string, unknown> = {
        plan,
        deliveryDays,
        location: {
          name: locationName.trim(),
          address: locationAddress.trim(),
        },
        contact: {
          name: contactName.trim(),
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
        },
        deliveryWindow: {
          from: windowFrom.trim(),
          to: windowTo.trim(),
        },
        status,
        deliveryNote: deliveryNote.trim() || null,
      };
      if (reason.trim()) payload.reason = reason.trim();

      const res = await fetch(apiUrl, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await readJsonSafe(res)) as { ok?: boolean; message?: string; rid?: string } | null;
      if (!res.ok || body?.ok !== true) {
        setErr(parseApiMessage(body as ApiErr, "Kunne ikke lagre avtale."));
        return;
      }
      onDone();
      onClose();
    });
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Lukk"
        disabled={pending || loading}
      />
      <div
        className="relative max-h-[90vh] w-[min(92vw,640px)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-agreement-edit-title"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Kundeadministrasjon</p>
        <h2 id="provider-agreement-edit-title" className="mt-1 text-lg font-semibold text-neutral-950">
          Endre kundeavtale
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          <span className="font-semibold text-neutral-800">{companyName}</span>
        </p>

        {loading ? <p className="mt-6 text-sm text-neutral-600">Laster avtale…</p> : null}

        {!loading && loaded ? (
          <div className="mt-5 space-y-6">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-neutral-800">Meny / avtalenivå</legend>
              <div className="flex flex-wrap gap-2">
                {PLANS.map((p) => (
                  <label key={p.value} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="plan"
                      value={p.value}
                      checked={plan === p.value}
                      onChange={() => setPlan(p.value)}
                      disabled={pending}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-neutral-800">Leveringsdager</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <label key={d.key} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={deliveryDays.includes(d.key)}
                      onChange={() => toggleDay(d.key)}
                      disabled={pending}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-neutral-500">Lunsjlevering mandag–fredag. Helg støttes ikke.</p>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-neutral-800">Leveringsadresse</legend>
              <label className="block text-xs font-semibold text-neutral-600">
                Navn på lokasjon
                <input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Adresse
                <input
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-neutral-800">Kontaktperson</legend>
              <label className="block text-xs font-semibold text-neutral-600">
                Navn
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                E-post
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Telefon
                <input
                  inputMode="numeric"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-neutral-800">Leveringsvindu</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-neutral-600">
                  Fra
                  <input
                    type="time"
                    value={windowFrom}
                    onChange={(e) => setWindowFrom(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    disabled={pending}
                  />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Til
                  <input
                    type="time"
                    value={windowTo}
                    onChange={(e) => setWindowTo(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    disabled={pending}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-neutral-800">Status</legend>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="status"
                    value="ACTIVE"
                    checked={status === "ACTIVE"}
                    onChange={() => setStatus("ACTIVE")}
                    disabled={pending}
                  />
                  Aktiv
                </label>
                <label className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="status"
                    value="PAUSED"
                    checked={status === "PAUSED"}
                    onChange={() => setStatus("PAUSED")}
                    disabled={pending}
                  />
                  Pauset
                </label>
              </div>
            </fieldset>

            <label className="block text-xs font-semibold text-neutral-600">
              Instruks for levering
              <textarea
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                disabled={pending}
              />
            </label>

            <label className="block text-xs font-semibold text-neutral-600">
              Begrunnelse (valgfritt, lagres i revisjonslogg)
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                disabled={pending}
              />
            </label>
          </div>
        ) : null}

        {err ? <p className="mt-4 text-sm font-semibold text-red-700">{err}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-full border px-4 py-2 text-sm hover:bg-neutral-50"
            onClick={onClose}
            disabled={pending}
          >
            Avbryt
          </button>
          <button
            type="button"
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            onClick={submit}
            disabled={!canSubmit}
          >
            {pending ? "Lagrer…" : "Lagre endringer"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
