"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import {
  resolveProviderCustomerApiError,
  type ProviderCustomerApiErrBody,
} from "@/lib/providers/providerCustomerActionErrors";

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

export default function ProviderCustomerRestoreDialog(props: {
  open: boolean;
  companyId: string;
  companyName: string;
  orgnr: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { open, companyId, companyName, orgnr, onClose, onDone } = props;
  const apiUrl = `/api/provider/customers/${encodeURIComponent(companyId)}/restore`;
  const tRestore = useTranslations("provider.customers.dialogs.restore");
  const tDialog = useTranslations("provider.customers.dialogs");
  const tErrors = useTranslations("provider.customers.errors");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setConfirm("");
    setErr(null);
    setSuccess(null);
  }, [open, companyId]);

  const confirmHint = useMemo(() => orgnr || companyName, [orgnr, companyName]);

  const confirmMatches = useMemo(() => {
    const v = confirm.trim();
    if (!v) return false;
    return v === companyName || (orgnr ? v === orgnr : false);
  }, [confirm, companyName, orgnr]);

  function submit() {
    setErr(null);
    startTransition(async () => {
      const res = await fetch(apiUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ confirmation: confirm.trim() }),
      });
      const body = (await readJsonSafe(res)) as {
        ok?: boolean;
        message?: string;
        rid?: string;
        data?: { message?: string };
      } | null;
      if (!res.ok || body?.ok !== true) {
        setErr(
          resolveProviderCustomerApiError(
            (key) => tErrors(key),
            body as ProviderCustomerApiErrBody,
            "restoreAction",
            res.status,
          ),
        );
        return;
      }
      const message = safeStr(body?.data?.message) || tRestore("successDefault");
      setSuccess(message);
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
        aria-label={tDialog("closeAria")}
        disabled={pending}
      />
      <div className="relative w-[min(92vw,560px)] rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{tDialog("adminEyebrow")}</p>
        <h2 className="mt-1 text-lg font-semibold text-neutral-950">{tRestore("title")}</h2>
        <p className="mt-2 text-sm text-neutral-700">
          <span className="font-semibold">{companyName}</span>
          {orgnr ? <span className="text-neutral-500"> · {orgnr}</span> : null}
        </p>
        <p className="mt-2 text-sm text-neutral-600">{tRestore("lead")}</p>
        <label className="mt-4 block text-xs font-semibold text-neutral-600">
          {tRestore("confirmLabel")}{" "}
          {confirmHint ? tRestore("confirmHint", { hint: confirmHint }) : ""}
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            autoComplete="off"
            disabled={pending}
          />
        </label>
        {err ? <p className="mt-3 text-sm font-semibold text-red-700">{err}</p> : null}
        {success ? <p className="mt-3 text-sm font-semibold text-emerald-800">{success}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-full border px-4 py-2 text-sm hover:bg-neutral-50" onClick={onClose} disabled={pending}>
            {tDialog("cancel")}
          </button>
          <button
            type="button"
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            onClick={submit}
            disabled={pending || !confirmMatches}
          >
            {pending ? tDialog("working") : tRestore("restoreCustomer")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
