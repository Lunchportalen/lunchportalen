"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import {
  controlTowerInsightAction,
  type ControlTowerInsightSurface,
} from "@/app/superadmin/control-tower/actions";

const btnBase =
  "relative inline-flex min-h-[44px] shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] touch-manipulation transition-[transform,background-color,box-shadow] duration-150 hover:bg-black/[0.02] active:scale-[0.98] active:bg-black/[0.04] disabled:opacity-50";
const btnPrimary =
  "relative inline-flex min-h-[44px] shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-fg))] touch-manipulation underline-offset-4 transition-[transform,background-color] duration-150 hover:underline hover:decoration-[var(--lp-hotpink)] hover:decoration-2 active:scale-[0.98] active:bg-[var(--lp-hotpink)]/8 disabled:opacity-50";

type Feedback = { text: string; ok: boolean };

type Props = {
  surface: ControlTowerInsightSurface;
  refKey: string;
  label?: string | null;
  /** Les mer / kontekst (f.eks. CFO, innhold) */
  detailHref?: string;
  /** Utfør arbeid (f.eks. vekstmotor) — brukes etter vellykket logg når satt */
  workHref?: string;
  /** Eksisterende API (f.eks. kapitalallokering) — returner true ved suksess */
  executeApi?: () => Promise<boolean>;
  onFeedback?: (f: Feedback) => void;
};

export function ControlTowerInsightActions({
  surface,
  refKey,
  label,
  detailHref,
  workHref,
  executeApi,
  onFeedback,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"execute" | "ignore" | "detail" | null>(null);

  const emit = useCallback(
    (text: string, ok: boolean) => {
      onFeedback?.({ text, ok });
    },
    [onFeedback],
  );

  const runLog = useCallback(
    async (choice: "execute" | "ignore" | "detail") => {
      const r = await controlTowerInsightAction({
        surface,
        choice,
        refKey,
        label: label ?? undefined,
      });
      return r.ok === true;
    },
    [surface, refKey, label],
  );

  const onIgnore = async () => {
    setBusy("ignore");
    try {
      const ok = await runLog("ignore");
      emit(ok ? "Handling utført" : "Feilet", ok);
    } finally {
      setBusy(null);
    }
  };

  const onDetailClick = async () => {
    setBusy("detail");
    try {
      const ok = await runLog("detail");
      emit(ok ? "Handling utført" : "Feilet", ok);
      if (ok && detailHref) {
        router.push(detailHref);
      }
    } finally {
      setBusy(null);
    }
  };

  const onExecute = async () => {
    setBusy("execute");
    try {
      const logged = await runLog("execute");
      if (!logged) {
        emit("Feilet", false);
        return;
      }
      if (executeApi) {
        const apiOk = await executeApi();
        emit(apiOk ? "Handling utført" : "Feilet", apiOk);
        return;
      }
      if (workHref) {
        router.push(workHref);
        emit("Handling utført", true);
        return;
      }
      emit("Handling utført", true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => void onExecute()}>
        {busy === "execute" ? "…" : "Utfør forslag"}
      </button>
      <button type="button" className={btnBase} disabled={busy !== null} onClick={() => void onIgnore()}>
        {busy === "ignore" ? "…" : "Ignorer"}
      </button>
      {detailHref ? (
        <Link
          href={detailHref}
          className={btnBase}
          onClick={(e) => {
            e.preventDefault();
            void onDetailClick();
          }}
        >
          {busy === "detail" ? "…" : "Se detaljer"}
        </Link>
      ) : (
        <button type="button" className={btnBase} disabled={busy !== null} onClick={() => void onDetailClick()}>
          {busy === "detail" ? "…" : "Se detaljer"}
        </button>
      )}
    </div>
  );
}
