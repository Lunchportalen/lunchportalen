"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BLOCK_CARD_PRESETS,
  DESIGN_SETTINGS_CARD_BLOCK_KEYS,
  type CardHover,
  type CardVariant,
  type ContainerWidthToken,
  mergeDesignSettingsIntoGlobalContentData,
  type SectionSpacingToken,
  type SectionSurfaceToken,
  type TypographyBodyToken,
  type TypographyHeadingToken,
} from "@/lib/cms/design/designContract";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

const VARIANTS: CardVariant[] = ["default", "glass", "elevated", "flat"];
const HOVERS: CardHover[] = ["none", "lift", "glow"];
const SURFACES: SectionSurfaceToken[] = ["default", "alt", "contrast"];
const SPACINGS: SectionSpacingToken[] = ["tight", "normal", "wide"];
const TYPO_H: TypographyHeadingToken[] = ["default", "display"];
const TYPO_B: TypographyBodyToken[] = ["default", "compact"];
const CONTAINERS: ContainerWidthToken[] = ["normal", "wide", "full"];

const LABELS: Record<string, string> = {
  default: "Standard (alle typer)",
  hero: "hero",
  richText: "richText",
  cta: "cta",
  image: "image",
  cards: "cards",
  pricing: "pricing",
  form: "form",
};

type RowState = { variant: CardVariant; hover: CardHover };

function rowFromCard(key: string, raw: unknown): RowState {
  const preset = BLOCK_CARD_PRESETS[key] ?? { variant: "default" as const, hover: "none" as const };
  if (!isPlainObject(raw)) return { variant: preset.variant, hover: preset.hover };
  const v = raw.variant;
  const h = raw.hover;
  const variant = VARIANTS.includes(v as CardVariant) ? (v as CardVariant) : preset.variant;
  const hover = HOVERS.includes(h as CardHover) ? (h as CardHover) : preset.hover;
  return { variant, hover };
}

function readSection(raw: unknown, allowed: string[], fallback: string): string {
  if (!isPlainObject(raw)) return fallback;
  const s = raw.section;
  return typeof s === "string" && allowed.includes(s) ? s : fallback;
}

/**
 * Global design system UI: card, surface, spacing, typography, layout → `settings.data.designSettings`.
 * Block `config` overrides these tokens at render time.
 */
export function GlobalDesignSystemSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsData, setSettingsData] = useState<Record<string, unknown> | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [surfaceSection, setSurfaceSection] = useState<SectionSurfaceToken>("default");
  const [spacingSection, setSpacingSection] = useState<SectionSpacingToken>("normal");
  const [typoHeading, setTypoHeading] = useState<TypographyHeadingToken>("default");
  const [typoBody, setTypoBody] = useState<TypographyBodyToken>("default");
  const [layoutContainer, setLayoutContainer] = useState<ContainerWidthToken>("normal");

  const keys = useMemo(() => [...DESIGN_SETTINGS_CARD_BLOCK_KEYS], []);

  const hydrateFromSettingsData = useCallback(
    (data: Record<string, unknown>) => {
      setSettingsData(data);
      const ds = isPlainObject(data.designSettings) ? data.designSettings : {};
      const card = isPlainObject(ds.card) ? ds.card : {};
      const next: Record<string, RowState> = {};
      for (const k of keys) {
        next[k] = rowFromCard(k, card[k]);
      }
      setRows(next);
      setSurfaceSection(readSection(ds.surface, SURFACES, "default") as SectionSurfaceToken);
      setSpacingSection(readSection(ds.spacing, SPACINGS, "normal") as SectionSpacingToken);
      const ty = isPlainObject(ds.typography) ? ds.typography : {};
      const h = ty.heading;
      const b = ty.body;
      setTypoHeading(h === "display" ? "display" : "default");
      setTypoBody(b === "compact" ? "compact" : "default");
      const ly = isPlainObject(ds.layout) ? ds.layout : {};
      const c = ly.container;
      setLayoutContainer(c === "wide" || c === "full" ? c : "normal");
    },
    [keys],
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/content/global/settings", { credentials: "include" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: unknown } | null;
      const data = json && isPlainObject(json.data) ? json.data : {};
      hydrateFromSettingsData(data);
    } catch {
      setError("Kunne ikke lese globale innstillinger.");
    } finally {
      setLoading(false);
    }
  }, [hydrateFromSettingsData]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const setRow = useCallback((key: string, patch: Partial<RowState>) => {
    setRows((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }, []);

  const mergeAndSave = useCallback(
    async (action: "save" | "publish") => {
      if (!settingsData || !isPlainObject(settingsData)) {
        setError("Innstillinger er ikke lastet — lagring blokkert.");
        return;
      }
      setSaving(true);
      setError(null);
      setToast(null);
      try {
        const card: Record<string, { variant: CardVariant; hover: CardHover }> = {};
        for (const k of keys) {
          const r = rows[k];
          if (r) card[k] = { variant: r.variant, hover: r.hover };
        }
        const base = mergeDesignSettingsIntoGlobalContentData({ ...settingsData }, {
          card,
          surface: { section: surfaceSection },
          spacing: { section: spacingSection },
          typography: { heading: typoHeading, body: typoBody },
          layout: { container: layoutContainer },
        });
        const body =
          action === "save" ? { action: "save", data: base } : { action: "publish", data: base };
        const res = await fetch("/api/content/global/settings", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!res.ok || json?.ok === false) {
          setError(json?.message ?? `Lagring feilet (HTTP ${res.status}).`);
          return;
        }
        setSettingsData(base);
        setToast(action === "publish" ? "Publisert: design system er oppdatert." : "Utkast lagret.");
        window.setTimeout(() => setToast(null), 6000);
      } catch {
        setError("Nettverksfeil ved lagring.");
      } finally {
        setSaving(false);
      }
    },
    [
      settingsData,
      rows,
      keys,
      surfaceSection,
      spacingSection,
      typoHeading,
      typoBody,
      layoutContainer,
    ],
  );

  return (
    <section className="mt-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
      <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Globalt design system (CMS)</h3>
      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
        <span className="font-medium text-[rgb(var(--lp-text))]">Omfang: globalt.</span> Gjelder hele nettstedet med mindre en enkelt side eller blokk overstyrer via godkjente tokens. Side
        velges i innholdstreet; blokk velges i redigereren — se «CMS-design (blokk)» i Egenskaper når en blokk er valgt.
      </p>
      <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
        Lagres under <code className="text-[10px]">designSettings</code>. AI og redaktør skal endre styling her — ikke i blokk{" "}
        <code className="text-[10px]">data</code>. Enkeltblokkers <code className="text-[10px]">config</code> overstyrer.
      </p>

      {loading ? (
        <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">Laster …</p>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="grid gap-3 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[11px]">
              <span className="font-medium text-[rgb(var(--lp-text))]">Overflate (seksjon)</span>
              <select
                className="h-9 rounded-md border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
                value={surfaceSection}
                onChange={(e) => setSurfaceSection(e.target.value as SectionSurfaceToken)}
              >
                {SURFACES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px]">
              <span className="font-medium text-[rgb(var(--lp-text))]">Vertikal rytme</span>
              <select
                className="h-9 rounded-md border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
                value={spacingSection}
                onChange={(e) => setSpacingSection(e.target.value as SectionSpacingToken)}
              >
                {SPACINGS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px]">
              <span className="font-medium text-[rgb(var(--lp-text))]">Overskrifter</span>
              <select
                className="h-9 rounded-md border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
                value={typoHeading}
                onChange={(e) => setTypoHeading(e.target.value as TypographyHeadingToken)}
              >
                {TYPO_H.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px]">
              <span className="font-medium text-[rgb(var(--lp-text))]">Brødtekst</span>
              <select
                className="h-9 rounded-md border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
                value={typoBody}
                onChange={(e) => setTypoBody(e.target.value as TypographyBodyToken)}
              >
                {TYPO_B.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] sm:col-span-2">
              <span className="font-medium text-[rgb(var(--lp-text))]">Innholdsbredde (container + header/footer)</span>
              <select
                className="h-9 rounded-md border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
                value={layoutContainer}
                onChange={(e) => setLayoutContainer(e.target.value as ContainerWidthToken)}
              >
                {CONTAINERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              Kort per blokktype
            </h4>
            <div className="space-y-3">
              {keys.map((key) => {
                const r = rows[key] ?? { variant: "default" as const, hover: "none" as const };
                return (
                  <div
                    key={key}
                    className="grid gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3 sm:grid-cols-3 sm:items-end"
                  >
                    <div className="text-xs font-medium text-[rgb(var(--lp-text))]">{LABELS[key] ?? key}</div>
                    <label className="grid gap-1 text-[11px]">
                      <span className="text-[rgb(var(--lp-muted))]">Variant</span>
                      <select
                        className="h-9 rounded-md border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
                        value={r.variant}
                        onChange={(e) => setRow(key, { variant: e.target.value as CardVariant })}
                      >
                        {VARIANTS.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-[11px]">
                      <span className="text-[rgb(var(--lp-muted))]">Hover</span>
                      <select
                        className="h-9 rounded-md border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
                        value={r.hover}
                        onChange={(e) => setRow(key, { hover: e.target.value as CardHover })}
                      >
                        {HOVERS.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
      {toast ? <p className="mt-3 text-xs text-green-700">{toast}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => void mergeAndSave("save")}
          className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 disabled:opacity-50"
        >
          Lagre utkast
        </button>
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => void mergeAndSave("publish")}
          className="min-h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Publiser
        </button>
      </div>
    </section>
  );
}

/** @deprecated Bruk GlobalDesignSystemSection */
export const GlobalCardDesignSection = GlobalDesignSystemSection;
