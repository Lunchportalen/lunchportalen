"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  LP_ALLERGEN_CATEGORY_CODES,
  LP_ALLERGEN_LABELS_NB,
  LP_GLUTEN_SUBTYPE_CODES,
  LP_TREE_NUT_SUBTYPE_CODES,
  LP_USER_ALLERGEN_FREE_TEXT_MAX,
  normalizeLpAllergenCodes,
  normalizeLpAllergenFreeText,
  stripGlutenSubtypes,
  stripTreeNutSubtypes,
  type LpAllergenCategoryCode,
  type LpAllergenCode,
  type LpUserAllergenProfile,
} from "@/lib/allergens/lpUserAllergens";

type SaveState = "idle" | "loading" | "success" | "invalid" | "error";

type ApiEnvelope = {
  ok?: boolean;
  data?: { profile?: LpUserAllergenProfile };
  message?: string;
  error?: string;
};

function readProfile(json: ApiEnvelope): LpUserAllergenProfile | null {
  if (!json.ok || !json.data?.profile) return null;
  return json.data.profile;
}

type UserAllergenProfileFormProps = {
  onProfileChange?: (profile: LpUserAllergenProfile) => void;
};

export default function UserAllergenProfileForm({ onProfileChange }: UserAllergenProfileFormProps) {
  const [codes, setCodes] = useState<LpAllergenCode[]>([]);
  const [freeText, setFreeText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const charCount = freeText.length;
  const charCountId = "allergen-free-text-count";
  const glutenSelected = codes.includes("gluten");
  const treeNutsSelected = codes.includes("tree_nuts");

  const loadProfile = useCallback(async () => {
    setLoadError(null);
    setSaveState("loading");
    try {
      const res = await fetch("/api/me/user-allergens", { credentials: "include" });
      const json = (await res.json()) as ApiEnvelope;
      const profile = readProfile(json);
      if (!res.ok || !profile) {
        setLoadError("Kunne ikke hente allergiprofil.");
        setSaveState("error");
        return;
      }
      setCodes(normalizeLpAllergenCodes(profile.codes));
      setFreeText(normalizeLpAllergenFreeText(profile.free_text));
      setSaveState("idle");
      onProfileChange?.(profile);
    } catch {
      setLoadError("Kunne ikke hente allergiprofil.");
      setSaveState("error");
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const resetSaveFeedback = () => {
    setSaveState("idle");
    setSaveMessage(null);
  };

  const toggleCategory = (code: LpAllergenCategoryCode) => {
    resetSaveFeedback();
    setCodes((prev) => {
      if (prev.includes(code)) {
        if (code === "gluten") return stripGlutenSubtypes(prev.filter((c) => c !== "gluten"));
        if (code === "tree_nuts") return stripTreeNutSubtypes(prev.filter((c) => c !== "tree_nuts"));
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  const toggleSubtype = (code: LpAllergenCode) => {
    resetSaveFeedback();
    setCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const onFreeTextChange = (value: string) => {
    resetSaveFeedback();
    setFreeText(value.slice(0, LP_USER_ALLERGEN_FREE_TEXT_MAX));
  };

  const saveDisabled = useMemo(() => saveState === "loading", [saveState]);

  const handleSave = async () => {
    if (charCount > LP_USER_ALLERGEN_FREE_TEXT_MAX) {
      setSaveState("invalid");
      setSaveMessage("Teksten er for lang (maks 280 tegn).");
      return;
    }

    setSaveState("loading");
    setSaveMessage(null);
    try {
      const res = await fetch("/api/me/user-allergens", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes, free_text: freeText }),
      });
      const json = (await res.json()) as ApiEnvelope;
      if (!res.ok) {
        setSaveState(res.status === 422 ? "invalid" : "error");
        setSaveMessage(json.message ?? "Kunne ikke lagre.");
        return;
      }
      const profile = readProfile(json);
      if (profile) {
        setCodes(normalizeLpAllergenCodes(profile.codes));
        setFreeText(normalizeLpAllergenFreeText(profile.free_text));
        onProfileChange?.(profile);
      }
      setSaveState("success");
      setSaveMessage("Lagret. Kjøkkenet kan se dette som ekstra info ved produksjon.");
    } catch {
      setSaveState("error");
      setSaveMessage("Kunne ikke lagre. Prøv igjen.");
    }
  };

  return (
    <div className="ds-allergen-profile mx-auto w-full px-4 py-6">
      {loadError ? (
        <p className="mt-4 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      ) : null}

      <fieldset className="ds-allergen-fieldset mt-6">
        <legend>Hva er du allergisk mot?</legend>
        <div className="ds-allergen-chip-grid" role="group" aria-label="Hva er du allergisk mot?">
          {LP_ALLERGEN_CATEGORY_CODES.map((code) => (
            <button
              key={code}
              type="button"
              className="ds-allergen-chip"
              aria-pressed={codes.includes(code)}
              onClick={() => toggleCategory(code)}
              disabled={saveDisabled}
            >
              {LP_ALLERGEN_LABELS_NB[code]}
            </button>
          ))}
        </div>
      </fieldset>

      {glutenSelected ? (
        <fieldset className="ds-allergen-fieldset mt-6">
          <legend>Velg kornslag</legend>
          <div className="ds-allergen-chip-grid" role="group" aria-label="Velg kornslag">
            {LP_GLUTEN_SUBTYPE_CODES.map((code) => (
              <button
                key={code}
                type="button"
                className="ds-allergen-chip"
                aria-pressed={codes.includes(code)}
                onClick={() => toggleSubtype(code)}
                disabled={saveDisabled}
              >
                {LP_ALLERGEN_LABELS_NB[code]}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {treeNutsSelected ? (
        <fieldset className="ds-allergen-fieldset mt-6">
          <legend>Velg type nøtt</legend>
          <div className="ds-allergen-chip-grid" role="group" aria-label="Velg type nøtt">
            {LP_TREE_NUT_SUBTYPE_CODES.map((code) => (
              <button
                key={code}
                type="button"
                className="ds-allergen-chip"
                aria-pressed={codes.includes(code)}
                onClick={() => toggleSubtype(code)}
                disabled={saveDisabled}
              >
                {LP_ALLERGEN_LABELS_NB[code]}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="mt-8 text-left">
        <label htmlFor="allergen-free-text" className="block text-sm font-semibold text-neutral-900">
          Er det noe mer vi bør vite?
        </label>
        <textarea
          id="allergen-free-text"
          className="ds-allergen-free-text"
          value={freeText}
          onChange={(e) => onFreeTextChange(e.target.value)}
          maxLength={LP_USER_ALLERGEN_FREE_TEXT_MAX}
          rows={4}
          disabled={saveDisabled}
          aria-describedby={charCountId}
          placeholder="F.eks. kryssreaksjoner eller noe kjøkkenet bør være ekstra obs på."
        />
        <p id={charCountId} className="ds-allergen-char-count" aria-live="polite">
          {charCount} / {LP_USER_ALLERGEN_FREE_TEXT_MAX} tegn
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <button
          type="button"
          className="lp-btn lp-btn--primary lp-neon-focus min-h-[48px] min-w-[12rem]"
          onClick={() => void handleSave()}
          disabled={saveDisabled}
          aria-busy={saveState === "loading"}
        >
          {saveState === "loading" ? "Lagrer…" : "Lagre allergiprofil"}
        </button>
        {saveMessage ? (
          <p
            className={`text-sm ${saveState === "success" ? "text-emerald-800" : saveState === "invalid" ? "text-amber-900" : "text-red-800"}`}
            role="status"
          >
            {saveMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
