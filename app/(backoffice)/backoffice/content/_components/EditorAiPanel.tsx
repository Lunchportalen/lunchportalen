"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseBackofficeAiJson } from "@/app/(backoffice)/backoffice/content/_components/editorAiContracts";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";

export type EditorAiMenuValue = {
  title: string;
  description: string;
  allergens: string[];
  images?: string[];
};

export type EditorAiMenuPatch = Pick<EditorAiMenuValue, "title" | "description" | "allergens">;

/** Client-side gate before Apply — strict CMS menu text shape (no images). */
export function validateCmsMenuApplyPatch(raw: unknown): { ok: true; data: EditorAiMenuPatch } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Ugyldig objekt." };
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== "string") return { ok: false, error: "title må være tekst." };
  if (typeof o.description !== "string") return { ok: false, error: "description må være tekst." };
  if (!Array.isArray(o.allergens)) return { ok: false, error: "allergens må være en liste." };
  const title = o.title.trim();
  const description = o.description.trim();
  const allergens = o.allergens.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (title.length < 2) return { ok: false, error: "Tittel må være minst 2 tegn." };
  if (title.length > 120) return { ok: false, error: "Tittel over 120 tegn." };
  if (description.length > 4000) return { ok: false, error: "Beskrivelse over 4000 tegn." };
  if (allergens.length > 32) return { ok: false, error: "For mange allergener." };
  for (const a of allergens) {
    if (a.length > 64) return { ok: false, error: "Allergen for langt." };
  }
  return { ok: true, data: { title, description, allergens } };
}

export type EditorAiPanelProps = {
  value: EditorAiMenuValue;
  mealType?: string;
  plan?: "basis" | "luxus";
  onApply: (patch: EditorAiMenuPatch) => void;
  onValueChange: (next: EditorAiMenuValue) => void;
  /** Valgt sideblokk i redigeringsfeltet — visuell kontekst (endrer ikke meny-AI API). */
  selectedBlockContext?: {
    typeLabel: string;
    summary: string;
    prevSummary?: string | null;
    nextSummary?: string | null;
  } | null;
};

async function postCmsMenu(body: Record<string, unknown>) {
  const res = await fetch("/api/backoffice/ai/cms-menu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

export function EditorAiPanel({
  value,
  mealType = "",
  plan: planProp = "luxus",
  onApply,
  onValueChange,
  selectedBlockContext = null,
}: EditorAiPanelProps) {
  const [mealTypeDraft, setMealTypeDraft] = useState(mealType);
  const [planDraft, setPlanDraft] = useState<"basis" | "luxus">(planProp === "basis" ? "basis" : "luxus");

  useEffect(() => {
    setMealTypeDraft(mealType);
  }, [mealType]);

  useEffect(() => {
    setPlanDraft(planProp === "basis" ? "basis" : "luxus");
  }, [planProp]);

  const [allowedMeals, setAllowedMeals] = useState<string[]>([]);
  const [allowlistErr, setAllowlistErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [intent, setIntent] = useState("");

  const [previewPatch, setPreviewPatch] = useState<EditorAiMenuPatch | null>(null);
  const [previewMealType, setPreviewMealType] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"improve" | "generate" | null>(null);

  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [qualityIssues, setQualityIssues] = useState<string[]>([]);

  const [weekJson, setWeekJson] = useState<string>("");

  const [cmsApplyBusy, setCmsApplyBusy] = useState(false);
  const [cmsDraftSuccess, setCmsDraftSuccess] = useState<string | null>(null);
  const [cmsDraftError, setCmsDraftError] = useState<string | null>(null);
  const [posUiLine, setPosUiLine] = useState<string | null>(null);

  const allergensLine = useMemo(() => value.allergens.join(", "), [value.allergens]);

  const validatedPreview = useMemo(() => (previewPatch ? validateCmsMenuApplyPatch(previewPatch) : null), [previewPatch]);

  const fetchAllowlist = useCallback(async () => {
    setAllowlistErr(null);
    const { res, json } = await postCmsMenu({ action: "meta_allowlist", plan: planDraft });
    const parsed = parseBackofficeAiJson(json);
    if (!res.ok || !parsed || parsed.ok !== true) {
      setAllowedMeals([]);
      setAllowlistErr(
        parsed && parsed.ok === false ? parsed.message : "Kunne ikke hente allowedMeals (sjekk CMS productPlan)."
      );
      return;
    }
    const data = parsed.data as Record<string, unknown>;
    const list = Array.isArray(data.allowedMeals) ? data.allowedMeals.map((x) => String(x).trim()).filter(Boolean) : [];
    setAllowedMeals(list);
  }, [planDraft]);

  useEffect(() => {
    void fetchAllowlist();
  }, [fetchAllowlist]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/backoffice/ai/status", { cache: "no-store" });
        if (!alive || !res.ok) return;
        const json = await res.json().catch(() => null);
        const data =
          json && typeof json === "object" && "data" in json ? (json as { data: unknown }).data : json;
        const o = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
        const pos = o?.pos && typeof o.pos === "object" ? (o.pos as Record<string, unknown>) : null;
        if (!pos) return;
        const lastRunAt = typeof pos.lastRunAt === "number" ? pos.lastRunAt : null;
        const pri = typeof pos.signalPriority === "string" ? pos.signalPriority : null;
        const active = typeof pos.activeSurfaces === "number" ? pos.activeSurfaces : null;
        const effMin = typeof pos.effectiveMinConfidence === "number" ? pos.effectiveMinConfidence : null;
        const effMax = typeof pos.effectiveMaxActive === "number" ? pos.effectiveMaxActive : null;
        if (lastRunAt != null) {
          const t = new Date(lastRunAt).toLocaleString("nb-NO");
          const parts = [`POS: siste syklus ${t}`];
          if (pri) parts.push(`prioritet ${pri}`);
          if (active != null) parts.push(`${active} aktive flater`);
          if (effMin != null) parts.push(`terskel ${effMin.toFixed(2)}`);
          if (effMax != null) parts.push(`maks ${effMax}`);
          if (alive) setPosUiLine(parts.join(" · "));
        } else if (alive) {
          setPosUiLine("POS: ingen syklus ennå på denne instansen.");
        }
      } catch {
        /* valgfritt — ikke blokker redaktør */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewPatch(null);
    setPreviewMealType(null);
    setPreviewMode(null);
    setErr(null);
    setCmsDraftSuccess(null);
    setCmsDraftError(null);
  }, []);

  const mealTypeForCmsDraft = useMemo(() => {
    if (previewMode === "generate" && previewMealType?.trim()) return previewMealType.trim();
    return mealTypeDraft.trim();
  }, [previewMode, previewMealType, mealTypeDraft]);

  const applyPreviewToCmsDraft = useCallback(async () => {
    if (!validatedPreview || validatedPreview.ok !== true) return;
    if (!mealTypeForCmsDraft) {
      setCmsDraftError("Skriv måltidstype som matcher meny-dokumentet i Sanity (eller bruk generert mealType).");
      setCmsDraftSuccess(null);
      return;
    }
    setCmsApplyBusy(true);
    setCmsDraftError(null);
    setCmsDraftSuccess(null);
    try {
      const res = await fetch("/api/backoffice/cms/menu-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          mealType: mealTypeForCmsDraft,
          patch: validatedPreview.data,
        }),
      });
      const json = await res.json().catch(() => null);
      const parsed = parseBackofficeAiJson(json);
      if (!res.ok || !parsed || parsed.ok !== true) {
        setCmsDraftError(parsed && parsed.ok === false ? parsed.message : "Kunne ikke lagre CMS-utkast.");
        return;
      }
      setCmsDraftSuccess("Saved to CMS draft");
    } catch {
      setCmsDraftError("Nettverksfeil.");
    } finally {
      setCmsApplyBusy(false);
    }
  }, [validatedPreview, mealTypeForCmsDraft]);

  const runImprove = useCallback(async () => {
    setBusy(true);
    setErr(null);
    clearPreview();
    try {
      const { res, json } = await postCmsMenu({
        action: "improve",
        input: {
          mealType: mealTypeDraft.trim() || undefined,
          title: value.title,
          description: value.description,
          allergens: value.allergens,
          allowedMeals,
          existingContent: { title: value.title, description: value.description, allergens: value.allergens },
        },
      });
      const parsed = parseBackofficeAiJson(json);
      if (!res.ok || !parsed || parsed.ok !== true) {
        setErr(parsed && parsed.ok === false ? parsed.message : "Forbedring feilet.");
        return;
      }
      const d = parsed.data as Record<string, unknown>;
      const candidate = { title: d.title, description: d.description, allergens: d.allergens };
      const v = validateCmsMenuApplyPatch(candidate);
      if (v.ok === false) {
        setErr(v.error);
        return;
      }
      setPreviewPatch(v.data);
      setPreviewMode("improve");
    } catch {
      setErr("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  }, [mealTypeDraft, value.title, value.description, value.allergens, allowedMeals, clearPreview]);

  const runGenerate = useCallback(async () => {
    setBusy(true);
    setErr(null);
    clearPreview();
    const intentTrim = intent.trim();
    if (!intentTrim) {
      setErr("Skriv et intent først.");
      setBusy(false);
      return;
    }
    try {
      const { res, json } = await postCmsMenu({
        action: "generate",
        plan: planDraft,
        intent: intentTrim,
        input: {
          plan: planDraft,
          intent: intentTrim,
          allowedMeals,
          mealType: mealTypeDraft.trim() || undefined,
          existingContent: { title: value.title, description: value.description, allergens: value.allergens },
        },
      });
      const parsed = parseBackofficeAiJson(json);
      if (!res.ok || !parsed || parsed.ok !== true) {
        setErr(parsed && parsed.ok === false ? parsed.message : "Generering feilet.");
        return;
      }
      const d = parsed.data as Record<string, unknown>;
      const mt = d.mealType != null ? String(d.mealType).trim() : "";
      const candidate = { title: d.title, description: d.description, allergens: d.allergens };
      const v = validateCmsMenuApplyPatch(candidate);
      if (v.ok === false) {
        setErr(v.error);
        return;
      }
      const nk = normalizeMealTypeKey(mt);
      const allowedKeys = new Set(allowedMeals.map((x) => normalizeMealTypeKey(x)).filter(Boolean));
      if (allowedMeals.length && mt && (!nk || !allowedKeys.has(nk))) {
        setErr("Modellen foreslo mealType utenfor allowedMeals — avvist.");
        return;
      }
      setPreviewPatch(v.data);
      setPreviewMealType(mt || null);
      setPreviewMode("generate");
    } catch {
      setErr("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  }, [intent, planDraft, mealTypeDraft, allowedMeals, clearPreview, value.title, value.description, value.allergens]);

  const runValidate = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setQualityScore(null);
    setQualityIssues([]);
    try {
      const { res, json } = await postCmsMenu({
        action: "validate",
        input: {
          mealType: mealTypeDraft.trim() || undefined,
          title: value.title,
          description: value.description,
          allergens: value.allergens,
          allowedMeals,
        },
      });
      const parsed = parseBackofficeAiJson(json);
      if (!res.ok || !parsed || parsed.ok !== true) {
        setErr(parsed && parsed.ok === false ? parsed.message : "Validering feilet.");
        return;
      }
      const d = parsed.data as Record<string, unknown>;
      const score = typeof d.score === "number" && Number.isFinite(d.score) ? Math.round(d.score) : null;
      const issues = Array.isArray(d.issues) ? d.issues.map((x) => String(x).trim()).filter(Boolean) : [];
      setQualityScore(score);
      setQualityIssues(issues);
    } catch {
      setErr("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  }, [mealTypeDraft, value.title, value.description, value.allergens, allowedMeals]);

  const runWeek = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setWeekJson("");
    try {
      const { res, json } = await postCmsMenu({
        action: "week_suggest",
        plan: planDraft,
        input: { plan: planDraft, allowedMeals },
      });
      const parsed = parseBackofficeAiJson(json);
      if (!res.ok || !parsed || parsed.ok !== true) {
        setErr(parsed && parsed.ok === false ? parsed.message : "Ukeforslag feilet.");
        return;
      }
      setWeekJson(JSON.stringify(parsed.data, null, 2));
    } catch {
      setErr("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  }, [planDraft, allowedMeals]);

  const applyPreview = useCallback(() => {
    if (!validatedPreview || validatedPreview.ok !== true) return;
    onApply(validatedPreview.data);
    clearPreview();
  }, [validatedPreview, onApply, clearPreview]);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-xs text-white/90">
      <p className="mb-2 text-[11px] leading-snug text-white/55">
        AI har forslag her — forhåndsvisning til du bekrefter; ingen auto-publisering fra produktsystemet.
      </p>
      {posUiLine ? <p className="mb-2 text-[10px] leading-snug text-white/45">{posUiLine}</p> : null}
      {selectedBlockContext ? (
        <div
          className="mb-3 rounded-lg border border-sky-400/35 bg-sky-950/40 px-2.5 py-2"
          role="status"
          aria-label="AI-kontekst valgt blokk"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/90">Blokkfokus</p>
          <p className="mt-0.5 text-[11px] font-medium text-white/90">{selectedBlockContext.summary}</p>
          <p className="mt-1 text-[10px] leading-snug text-white/55">
            Tekst-/bilde-AI i hovedfeltet bruker denne blokken. Meny-AI under gjelder fortsatt kun menyutkast (tittel/beskrivelse/allergener).
          </p>
          {selectedBlockContext.prevSummary || selectedBlockContext.nextSummary ? (
            <ul className="mt-2 space-y-0.5 border-t border-sky-400/25 pt-2 text-[10px] leading-snug text-white/50">
              {selectedBlockContext.prevSummary ? (
                <li className="truncate" title={selectedBlockContext.prevSummary}>
                  Forrige: {selectedBlockContext.prevSummary}
                </li>
              ) : null}
              {selectedBlockContext.nextSummary ? (
                <li className="truncate" title={selectedBlockContext.nextSummary}>
                  Neste: {selectedBlockContext.nextSummary}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Meny (CMS) — AI</div>
      <p className="mt-1 text-[11px] leading-snug text-white/55">
        Arbeidsutkast for Sanity-meny (tittel/beskrivelse/allergener). Lagre siden som vanlig; kopier til Studio ved behov.
        Ingen automatisk publisering.
      </p>

      {allowlistErr ? <div className="mt-2 text-amber-200/90">{allowlistErr}</div> : null}
      {allowedMeals.length ? (
        <div className="mt-2 text-[10px] text-white/45">allowedMeals: {allowedMeals.join(", ")}</div>
      ) : null}

      <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] text-white/60">Produktplan (CMS)</label>
          <select
            className="mt-0.5 w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white"
            value={planDraft}
            onChange={(e) => setPlanDraft(e.target.value === "basis" ? "basis" : "luxus")}
          >
            <option value="luxus">Luxus</option>
            <option value="basis">Basis</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-white/60">Måltidstype (valgfritt)</label>
          <input
            className="mt-0.5 w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white"
            value={mealTypeDraft}
            onChange={(e) => setMealTypeDraft(e.target.value)}
            placeholder="f.eks. paasmurt"
          />
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <label className="block text-[11px] text-white/60">Tittel</label>
        <input
          className="w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white"
          value={value.title}
          onChange={(e) => onValueChange({ ...value, title: e.target.value })}
        />
        <label className="block text-[11px] text-white/60">Beskrivelse</label>
        <textarea
          className="min-h-[56px] w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white"
          value={value.description}
          onChange={(e) => onValueChange({ ...value, description: e.target.value })}
        />
        <label className="block text-[11px] text-white/60">Allergener (kommaseparert)</label>
        <input
          className="w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white"
          value={allergensLine}
          onChange={(e) =>
            onValueChange({
              ...value,
              allergens: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </div>

      {err ? <div className="mt-2 text-rose-300/95">{err}</div> : null}

      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <div className="text-[11px] font-medium text-white/70">1. Forbedre</div>
        <button
          type="button"
          disabled={busy || !value.title.trim()}
          onClick={() => void runImprove()}
          className="w-full rounded-lg bg-white/10 px-2 py-1.5 text-xs font-medium hover:bg-white/15 disabled:opacity-40"
        >
          {busy ? "…" : "Kjør forbedring"}
        </button>
      </div>

      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <div className="text-[11px] font-medium text-white/70">2. Generer</div>
        <textarea
          className="min-h-[44px] w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white"
          placeholder="Intent (f.eks. sunn fisk til kontorlunsj)"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void runGenerate()}
          className="w-full rounded-lg bg-white/10 px-2 py-1.5 text-xs font-medium hover:bg-white/15 disabled:opacity-40"
        >
          {busy ? "…" : "Generer forslag"}
        </button>
      </div>

      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <div className="text-[11px] font-medium text-white/70">3. Kvalitet</div>
        <button
          type="button"
          disabled={busy || !value.title.trim()}
          onClick={() => void runValidate()}
          className="w-full rounded-lg bg-white/10 px-2 py-1.5 text-xs font-medium hover:bg-white/15 disabled:opacity-40"
        >
          {busy ? "…" : "Score + issues"}
        </button>
        {qualityScore != null ? (
          <div className="rounded-lg bg-black/25 px-2 py-1.5 text-white/85">
            <span className="font-semibold">Score: {qualityScore}</span>
            {qualityIssues.length ? (
              <ul className="mt-1 list-inside list-disc text-[11px] text-white/70">
                {qualityIssues.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-[11px] text-white/55">Ingen issues.</div>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <div className="text-[11px] font-medium text-white/70">4. Uke (kun lesning)</div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runWeek()}
          className="w-full rounded-lg bg-white/10 px-2 py-1.5 text-xs font-medium hover:bg-white/15 disabled:opacity-40"
        >
          {busy ? "…" : "Foreslå uke"}
        </button>
        {weekJson ? (
          <pre className="max-h-32 overflow-auto rounded-lg bg-black/35 p-2 text-[10px] text-emerald-100/95">{weekJson}</pre>
        ) : null}
      </div>

      {previewPatch && previewMode ? (
        <div className="mt-3 space-y-2 border-t border-amber-400/30 bg-amber-500/5 p-2">
          <div className="text-[11px] font-semibold text-amber-100/90">Forhåndsvisning ({previewMode})</div>
          {previewMealType ? (
            <div className="text-[11px] text-amber-100/80">
              Forslått mealType (sett i Sanity): <span className="font-mono">{previewMealType}</span>
            </div>
          ) : null}
          <DiffRow label="Tittel" before={value.title} after={previewPatch.title} />
          <DiffRow label="Beskrivelse" before={value.description} after={previewPatch.description} />
          <DiffRow label="Allergener" before={allergensLine} after={previewPatch.allergens.join(", ")} />
          {validatedPreview && validatedPreview.ok === false ? (
            <div className="text-rose-300/95">{validatedPreview.error}</div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={!validatedPreview || validatedPreview.ok !== true}
              onClick={applyPreview}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Bruk i utkast
            </button>
            <button
              type="button"
              disabled={
                !validatedPreview ||
                validatedPreview.ok !== true ||
                cmsApplyBusy ||
                !mealTypeForCmsDraft
              }
              onClick={() => void applyPreviewToCmsDraft()}
              className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {cmsApplyBusy ? "…" : "Apply to CMS draft"}
            </button>
            <button
              type="button"
              onClick={clearPreview}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/85"
            >
              Forkast
            </button>
          </div>
          {!mealTypeForCmsDraft ? (
            <div className="text-[10px] text-amber-200/85">
              Skriv måltidstype (eller generer med mealType) for å bruke CMS-utkast.
            </div>
          ) : null}
          {cmsDraftSuccess ? <div className="text-[11px] text-emerald-200/95">{cmsDraftSuccess}</div> : null}
          {cmsDraftError ? <div className="text-[11px] text-rose-300/95">{cmsDraftError}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function DiffRow({ label, before, after }: { label: string; before: string; after: string }) {
  const changed = before !== after;
  return (
    <div className={changed ? "rounded border border-amber-400/25 bg-black/20 p-1.5" : "p-1.5"}>
      <div className="text-[10px] font-medium text-white/50">{label}</div>
      <div className="text-[10px] text-white/45 line-through">{before || "—"}</div>
      <div className={`text-[11px] ${changed ? "text-amber-100" : "text-white/70"}`}>{after || "—"}</div>
    </div>
  );
}
