// components/toast/OrderToastBridge.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useOrderError, useOrderReceipt } from "@/lib/orders/OrderActionsProvider";

// Disse må finnes hos deg (du har dem i PortalProviders-koden du fikk):
// - useToast(): { push(...) }
// - useFeatureFlags(): { isOn(key) }
// Hvis du har flyttet dem til egne filer, oppdater importene her.
import { useToast } from "@/components/providers/PortalProviders";
import { useFeatureFlags } from "@/components/providers/PortalProviders";

/* =========================================================
   A5 — Order → Toast bridge (StrictMode-safe)
   - Listens to receipt/error via selectors (no portal rerender)
   - Dedupe by rid across remounts (module cache + TTL)
========================================================= */

const RID_TTL_MS = 12_000;

// Module-level cache survives StrictMode remounts in dev.
const seenRid = new Map<string, number>();

function shouldEmitRid(rid: string) {
  const now = Date.now();

  // cleanup old rids
  for (const [k, t] of seenRid) {
    if (now - t > RID_TTL_MS) seenRid.delete(k);
  }

  const prev = seenRid.get(rid);
  if (prev && now - prev < RID_TTL_MS) return false;

  seenRid.set(rid, now);
  return true;
}

function safeMsg(v: unknown) {
  const s = String(v ?? "").trim();
  return s || "Uventet feil.";
}

export default function OrderToastBridge() {
  const toast = useToast();
  const flags = useFeatureFlags();

  // A5 on/off (default ON if flag missing)
  const enabled = useMemo(() => {
    try {
      // If you use flags, respect it:
      // true => enable bridge
      // false => disable
      return typeof flags?.isOn === "function" ? flags.isOn("toastBridgeA5") : true;
    } catch {
      return true;
    }
  }, [flags]);

  // Selector-based (only rerenders this bridge)
  const receipt = useOrderReceipt();
  const error = useOrderError();

  useEffect(() => {
    if (!enabled) return;
    if (!receipt) return;

    if (!receipt.rid) return;
    if (!shouldEmitRid(receipt.rid)) return;

    toast.push({
      kind: "success",
      title: "Registrert",
      message: safeMsg(receipt.message ?? "OK."),
      ttlMs: 3500,
    });
  }, [enabled, receipt, toast]);

  useEffect(() => {
    if (!enabled) return;
    if (!error) return;

    if (!error.rid) return;
    if (!shouldEmitRid(error.rid)) return;

    toast.push({
      kind: "error",
      title: "Feil",
      message: safeMsg(error.message),
      ttlMs: 5500,
    });
  }, [enabled, error, toast]);

  return null;
}
