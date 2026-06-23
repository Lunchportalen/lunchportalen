"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import type { DayKey, Tier } from "@/lib/agreements/normalize";
import type { InvoiceMethod } from "@/lib/providers/providerCustomerBilling";
import { suggestEhfEndpoint } from "@/lib/providers/providerCustomerBilling";
import {
  resolveProviderCustomerApiError,
  type ProviderCustomerApiErrBody,
} from "@/lib/providers/providerCustomerActionErrors";

import type { ProviderAgreementReadModel } from "@/lib/providers/providerCustomerAgreementTypes";

const WEEKDAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

const PLANS: Array<{ value: Tier; label: string }> = [
  { value: "BASIS", label: "Basis" },
  { value: "LUXUS", label: "Luxus" },
  { value: "ENTERPRISE", label: "Enterprise" },
];

type DayEditorState = Record<DayKey, { enabled: boolean; plan: Tier }>;

function defaultDayState(plan: Tier = "BASIS"): DayEditorState {
  return {
    mon: { enabled: true, plan },
    tue: { enabled: true, plan },
    wed: { enabled: true, plan },
    thu: { enabled: true, plan },
    fri: { enabled: true, plan },
  };
}

function dayStateFromAgreement(data: ProviderAgreementReadModel): DayEditorState {
  const fallback = data.defaultPlan ?? "BASIS";
  const state = defaultDayState(fallback);
  const active = new Set(data.deliveryDays);
  for (const key of WEEKDAY_KEYS) {
    state[key].enabled = active.has(key);
  }
  for (const menu of data.dayMenus) {
    const key = menu.day;
    if (key in state) {
      state[key].plan = menu.plan;
      state[key].enabled = active.has(key);
    }
  }
  return state;
}

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

export default function ProviderCustomerAgreementEditDialog(props: {
  open: boolean;
  companyId: string;
  companyName: string;
  onClose: () => void;
  onDone: (message?: string) => void;
}) {
  const { open, companyId, companyName, onClose, onDone } = props;
  const apiUrl = `/api/provider/customers/${encodeURIComponent(companyId)}/agreement`;
  const tEdit = useTranslations("provider.customers.dialogs.agreementEdit");
  const tAgreement = useTranslations("provider.customers.agreement");
  const tDialog = useTranslations("provider.customers.dialogs");
  const tErrors = useTranslations("provider.customers.errors");

  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<ProviderAgreementReadModel | null>(null);

  const [dayState, setDayState] = useState<DayEditorState>(defaultDayState());
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
  const [invoiceMethod, setInvoiceMethod] = useState<InvoiceMethod>("EMAIL");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [billingOrgnr, setBillingOrgnr] = useState("");
  const [ehfEndpoint, setEhfEndpoint] = useState("");
  const [billingContactName, setBillingContactName] = useState("");
  const [billingContactEmail, setBillingContactEmail] = useState("");
  const [billingContactPhone, setBillingContactPhone] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setFieldErr(null);
    setLoaded(null);
    setLoading(true);

    void (async () => {
      const res = await fetch(apiUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const body = (await readJsonSafe(res)) as {
        ok?: boolean;
        data?: ProviderAgreementReadModel;
        rid?: string;
        message?: string;
      } | null;
      setLoading(false);
      if (!res.ok || body?.ok !== true || !body.data) {
        setErr(
          resolveProviderCustomerApiError(
            (key) => tErrors(key),
            body as ProviderCustomerApiErrBody,
            "agreementLoad",
            res.status,
          ),
        );
        return;
      }
      const data = body.data;
      setLoaded(data);
      setDayState(dayStateFromAgreement(data));
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
      const billing = data.billing;
      setInvoiceMethod(billing.method === "EHF" ? "EHF" : "EMAIL");
      setInvoiceEmail(billing.invoiceEmail ?? "");
      setBillingOrgnr(billing.orgnr ?? "");
      setEhfEndpoint(billing.ehfEndpoint ?? suggestEhfEndpoint(billing.orgnr) ?? "");
      setBillingContactName(billing.contact.name ?? "");
      setBillingContactEmail(billing.contact.email ?? "");
      setBillingContactPhone(billing.contact.phone ?? "");
    })();
  }, [open, companyId, apiUrl, tErrors]);

  const activeDays = useMemo(
    () => WEEKDAY_KEYS.filter((key) => dayState[key].enabled),
    [dayState],
  );

  const canSubmit = useMemo(() => {
    return Boolean(loaded) && activeDays.length > 0 && !loading && !pending;
  }, [loaded, activeDays.length, loading, pending]);

  function setDayEnabled(key: DayKey, enabled: boolean) {
    setDayState((prev) => {
      const next = { ...prev };
      const enabledCount = WEEKDAY_KEYS.filter((k) => (k === key ? enabled : next[k].enabled)).length;
      if (!enabled && enabledCount === 0) return prev;
      next[key] = { ...next[key], enabled };
      return next;
    });
    setFieldErr(null);
  }

  function setDayPlan(key: DayKey, plan: Tier) {
    setDayState((prev) => ({ ...prev, [key]: { ...prev[key], plan } }));
    setFieldErr(null);
  }

  function validateLocal(): string | null {
    if (activeDays.length === 0) return tEdit("validation.pickDeliveryDay");
    for (const key of activeDays) {
      if (!dayState[key].plan) {
        return tEdit("validation.pickMenuForDay", { day: tAgreement(`weekdays.${key}`) });
      }
    }
    if (contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim())) {
      return tEdit("validation.invalidEmail");
    }
    if (invoiceMethod === "EMAIL") {
      if (!invoiceEmail.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(invoiceEmail.trim())) {
        return tEdit("validation.invoiceEmailRequired");
      }
    }
    if (invoiceMethod === "EHF") {
      const orgDigits = billingOrgnr.replace(/\D/g, "");
      const endpoint = ehfEndpoint.trim() || suggestEhfEndpoint(orgDigits) || "";
      if (!endpoint) return tEdit("validation.ehfEndpointRequired");
      if (orgDigits && orgDigits.length !== 9) return tEdit("validation.orgnrLength");
    }
    if (billingContactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(billingContactEmail.trim())) {
      return tEdit("validation.invalidBillingEmail");
    }
    return null;
  }

  function handleBillingOrgnrChange(value: string) {
    setBillingOrgnr(value);
    const suggested = suggestEhfEndpoint(value);
    if (suggested) setEhfEndpoint(suggested);
  }

  function submit() {
    if (!loaded) return;
    const localErr = validateLocal();
    if (localErr) {
      setFieldErr(localErr);
      return;
    }
    setErr(null);
    setFieldErr(null);

    startTransition(async () => {
      const deliveryDays = activeDays;
      const dayMenus = activeDays.map((day) => ({ day, plan: dayState[day].plan }));
      const payload: Record<string, unknown> = {
        deliveryDays,
        dayMenus,
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
        billing: {
          method: invoiceMethod,
          invoiceEmail: invoiceMethod === "EMAIL" ? invoiceEmail.trim() : undefined,
          orgnr: invoiceMethod === "EHF" ? billingOrgnr.trim() : undefined,
          ehfEndpoint:
            invoiceMethod === "EHF"
              ? ehfEndpoint.trim() || suggestEhfEndpoint(billingOrgnr) || undefined
              : undefined,
          contact: {
            name: billingContactName.trim(),
            email: billingContactEmail.trim(),
            phone: billingContactPhone.trim(),
          },
        },
      };
      if (reason.trim()) payload.reason = reason.trim();

      const res = await fetch(apiUrl, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await readJsonSafe(res)) as {
        ok?: boolean;
        message?: string;
        rid?: string;
        data?: { agreement?: ProviderAgreementReadModel; message?: string; warnings?: string[] };
      } | null;
      if (!res.ok || body?.ok !== true) {
        setErr(
          resolveProviderCustomerApiError(
            (key) => tErrors(key),
            body as ProviderCustomerApiErrBody,
            "agreementSave",
            res.status,
          ),
        );
        return;
      }
      const warnings = body?.data?.warnings ?? body?.data?.agreement?.warnings ?? [];
      const message =
        warnings.length > 0
          ? tEdit("updatedWithWarnings", { warnings: warnings.join(" ") })
          : body?.data?.message ?? tEdit("updated");
      onDone(message);
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
        aria-label={tDialog("closeAria")}
        disabled={pending || loading}
      />
      <div
        className="relative max-h-[90vh] w-[min(92vw,680px)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-agreement-edit-title"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{tDialog("adminEyebrow")}</p>
        <h2 id="provider-agreement-edit-title" className="mt-1 text-lg font-semibold text-neutral-950">
          {tEdit("title")}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          <span className="font-semibold text-neutral-800">{companyName}</span>
        </p>

        {loading ? <p className="mt-6 text-sm text-neutral-600">{tEdit("loading")}</p> : null}

        {!loading && loaded ? (
          <div className="mt-5 space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-neutral-800">{tEdit("dayMenusLegend")}</legend>
              <p className="text-xs text-neutral-500">{tEdit("dayMenusLead")}</p>
              <div className="space-y-2">
                {WEEKDAY_KEYS.map((dayKey) => {
                  const row = dayState[dayKey];
                  return (
                    <div key={dayKey} className="ds-provider-day-menu-row grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border px-3 py-2">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-800">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(e) => setDayEnabled(dayKey, e.target.checked)}
                          disabled={pending}
                        />
                        {tAgreement(`weekdays.${dayKey}`)}
                      </label>
                      <div className={`flex flex-wrap gap-1 ${row.enabled ? "" : "opacity-40 pointer-events-none"}`}>
                        {PLANS.map((p) => (
                          <label key={p.value} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                            <input
                              type="radio"
                              name={`plan-${dayKey}`}
                              value={p.value}
                              checked={row.plan === p.value}
                              onChange={() => setDayPlan(dayKey, p.value)}
                              disabled={pending || !row.enabled}
                            />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-neutral-500">{tEdit("weekdaysOnlyNote")}</p>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-neutral-800">{tEdit("locationLegend")}</legend>
              <label className="block text-xs font-semibold text-neutral-600">
                {tEdit("locationName")}
                <input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                {tEdit("address")}
                <input
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-neutral-800">{tEdit("contactLegend")}</legend>
              <label className="block text-xs font-semibold text-neutral-600">
                {tEdit("name")}
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                {tEdit("email")}
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                {tEdit("phone")}
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
              <legend className="text-sm font-semibold text-neutral-800">{tEdit("deliveryWindowLegend")}</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-neutral-600">
                  {tEdit("from")}
                  <input
                    type="time"
                    value={windowFrom}
                    onChange={(e) => setWindowFrom(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    disabled={pending}
                  />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  {tEdit("to")}
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

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-neutral-800">{tEdit("billingLegend")}</legend>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="invoiceMethod"
                    value="EMAIL"
                    checked={invoiceMethod === "EMAIL"}
                    onChange={() => setInvoiceMethod("EMAIL")}
                    disabled={pending}
                  />
                  {tEdit("invoiceEmail")}
                </label>
                <label className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="invoiceMethod"
                    value="EHF"
                    checked={invoiceMethod === "EHF"}
                    onChange={() => setInvoiceMethod("EHF")}
                    disabled={pending}
                  />
                  {tEdit("ehf")}
                </label>
              </div>
              {invoiceMethod === "EMAIL" ? (
                <label className="block text-xs font-semibold text-neutral-600">
                  {tEdit("invoiceEmailField")}
                  <input
                    type="email"
                    value={invoiceEmail}
                    onChange={(e) => setInvoiceEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    disabled={pending}
                  />
                </label>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-neutral-600">
                    {tEdit("orgnr")}
                    <input
                      inputMode="numeric"
                      value={billingOrgnr}
                      onChange={(e) => handleBillingOrgnrChange(e.target.value)}
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                      disabled={pending}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    {tEdit("ehfEndpoint")}
                    <input
                      value={ehfEndpoint}
                      onChange={(e) => setEhfEndpoint(e.target.value)}
                      placeholder="0192:928038777"
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                      disabled={pending}
                    />
                  </label>
                </>
              )}
              <p className="text-xs font-semibold text-neutral-700">{tEdit("billingContact")}</p>
              <label className="block text-xs font-semibold text-neutral-600">
                {tEdit("name")}
                <input
                  value={billingContactName}
                  onChange={(e) => setBillingContactName(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                {tEdit("email")}
                <input
                  type="email"
                  value={billingContactEmail}
                  onChange={(e) => setBillingContactEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                {tEdit("phone")}
                <input
                  inputMode="numeric"
                  value={billingContactPhone}
                  onChange={(e) => setBillingContactPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-neutral-800">{tEdit("statusLegend")}</legend>
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
                  {tEdit("statusActive")}
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
                  {tEdit("statusPaused")}
                </label>
              </div>
            </fieldset>

            <label className="block text-xs font-semibold text-neutral-600">
              {tEdit("deliveryNote")}
              <textarea
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                disabled={pending}
              />
            </label>

            <label className="block text-xs font-semibold text-neutral-600">
              {tEdit("reasonOptional")}
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                disabled={pending}
              />
            </label>
          </div>
        ) : null}

        {fieldErr ? <p className="mt-4 text-sm font-semibold text-red-700">{fieldErr}</p> : null}
        {err ? <p className="mt-4 text-sm font-semibold text-red-700">{err}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-full border px-4 py-2 text-sm hover:bg-neutral-50"
            onClick={onClose}
            disabled={pending}
          >
            {tDialog("cancel")}
          </button>
          <button
            type="button"
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            onClick={submit}
            disabled={!canSubmit}
          >
            {pending ? tEdit("saving") : tEdit("save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
