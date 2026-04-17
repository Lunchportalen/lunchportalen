import React from "react";
import { Section } from "@/components/ui/Section";
import { TextBlock } from "@/components/ui/TextBlock";
import type { MergedDesign, ParsedDesignSettings } from "@/lib/cms/design/designContract";
import {
  cardSurfaceClassString,
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
  mergedHeadingClassString,
  resolvedCardForBlockType,
} from "@/lib/cms/design/designContract";

export type StatsKpiItem = {
  id: string;
  value: string;
  label: string;
  subtext: string;
  /** Short token (e.g. "12" or "★") shown in a small ring above the value when set. */
  icon: string;
  emphasis: boolean;
};

function cn(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

function textAlignFromVariant(v: unknown): string {
  const t = String(v ?? "center").toLowerCase();
  if (t === "left") return "text-left";
  if (t === "right") return "text-right";
  return "text-center";
}

function gridColsClass(cols: unknown): string {
  const n = String(cols ?? "3").trim();
  if (n === "2") return "sm:grid-cols-2";
  if (n === "4") return "sm:grid-cols-2 lg:grid-cols-4";
  return "sm:grid-cols-3";
}

function densityGap(d: unknown): string {
  const t = String(d ?? "comfortable").toLowerCase();
  if (t === "compact") return "gap-4";
  if (t === "airy") return "gap-8";
  return "gap-6";
}

function parseBoolish(v: unknown): boolean {
  if (v === true) return true;
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes" || s === "highlight";
}

function parseKpisJson(raw: unknown): StatsKpiItem[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `kpi-${idx}`;
        const value = typeof o.value === "string" ? o.value : "";
        const label = typeof o.label === "string" ? o.label : "";
        if (!value.trim() && !label.trim()) return null;
        return {
          id,
          value,
          label,
          subtext: typeof o.subtext === "string" ? o.subtext : "",
          icon: typeof o.icon === "string" ? o.icon : "",
          emphasis: parseBoolish(o.emphasis ?? o.highlight),
        };
      })
      .filter((x): x is StatsKpiItem => x != null);
  } catch {
    return [];
  }
}

/** Build KPI rows from registry `data` (`kpis`, `kpisJson`, or legacy `s1`–`s3`). */
export function kpisFromStatsBlockData(data: Record<string, unknown>): StatsKpiItem[] {
  if (Array.isArray(data.kpis)) {
    const raw = data.kpis as unknown[];
    const out = raw
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `kpi-${idx}`;
        const value = typeof o.value === "string" ? o.value : "";
        const label = typeof o.label === "string" ? o.label : "";
        if (!value.trim() && !label.trim()) return null;
        return {
          id,
          value,
          label,
          subtext: typeof o.subtext === "string" ? o.subtext : "",
          icon: typeof o.icon === "string" ? o.icon : "",
          emphasis: parseBoolish(o.emphasis ?? o.highlight),
        };
      })
      .filter((x): x is StatsKpiItem => x != null);
    if (out.length) return out;
  }
  const fromJson = parseKpisJson(data.kpisJson);
  if (fromJson.length) return fromJson;
  const legacy: StatsKpiItem[] = [];
  for (let n = 1; n <= 3; n++) {
    const vk = `s${n}Value`;
    const lk = `s${n}Label`;
    const val = typeof data[vk] === "string" ? (data[vk] as string) : "";
    const lab = typeof data[lk] === "string" ? (data[lk] as string) : "";
    if (!val.trim() && !lab.trim()) continue;
    legacy.push({
      id: `kpi-${n}`,
      value: val,
      label: lab,
      subtext: "",
      icon: "",
      emphasis: false,
    });
  }
  return legacy;
}

export type StatsKpiBlockProps = {
  merged: MergedDesign;
  designSettings: ParsedDesignSettings | null;
  title: string;
  kpis: StatsKpiItem[];
  density: unknown;
  columns: unknown;
  variant: unknown;
};

/**
 * KPI / stats strip (`stats_block`). Prefer structured `kpis` / `kpisJson`; legacy `s1Value`/`s1Label`… still supported.
 */
export function StatsKpiBlock({ merged, designSettings, title, kpis, density, columns, variant }: StatsKpiBlockProps) {
  const ds = designSettings;
  const list = kpis.filter((k) => k.value.trim() || k.label.trim());
  if (list.length === 0) return null;
  const ta = textAlignFromVariant(variant);
  const t = title.trim();
  const grid = cn("grid w-full max-w-full", gridColsClass(columns), densityGap(density));
  const cardBase = cardSurfaceClassString(resolvedCardForBlockType("cards", merged.card, ds));

  return (
    <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
      {t ?
        <div className={cn("lp-section-head mb-6", ta)}>
          <h2 className={mergedHeadingClassString(merged, "h2")}>{t}</h2>
        </div>
      : null}
      <div className={grid}>
        {list.map((k) => (
          <div
            key={k.id}
            className={cn(
              cardBase,
              "text-center",
              k.emphasis && "ring-2 ring-pink-500/25",
            )}
          >
            {k.icon.trim() ?
              <div className="mb-2 flex justify-center">
                <span className="lp-neon-ring inline-flex h-9 min-w-[2.25rem] items-center justify-center px-2 text-xs font-semibold">
                  {k.icon.trim().slice(0, 2)}
                </span>
              </div>
            : null}
            {k.value.trim() ? <div className={mergedHeadingClassString(merged, "h2")}>{k.value.trim()}</div> : null}
            {k.label.trim() ?
              <div className="mt-1 text-sm font-medium text-[rgb(var(--lp-text))]">{k.label.trim()}</div>
            : null}
            {k.subtext.trim() ?
              <TextBlock className={cn(mergedBodyClassString(merged, { measure: true }), "mt-2 text-center text-xs text-[rgb(var(--lp-muted))]")}>
                {k.subtext.trim()}
              </TextBlock>
            : null}
          </div>
        ))}
      </div>
    </Section>
  );
}
