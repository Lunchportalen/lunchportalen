import React from "react";
import Link from "next/link";

import MediaFrame from "@/components/ui/MediaFrame";
import { Section } from "@/components/ui/Section";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import {
  marketingContainerClassString,
  marketingSectionClassString,
  mergedHeadingClassString,
} from "@/lib/cms/design/designContract";
import { normalizeDisplayText } from "@/lib/cms/displayText";
import { safeAltForImg } from "@/lib/media/renderSafe";

export type LogoCloudItem = {
  id: string;
  image: string;
  label: string;
  href: string;
};

function cn(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

function flexJustifyFromVariant(v: unknown): string {
  const t = String(v ?? "center").toLowerCase();
  if (t === "left") return "justify-start";
  if (t === "right") return "justify-end";
  return "justify-center";
}

function textAlignFromVariant(v: unknown): string {
  const t = String(v ?? "center").toLowerCase();
  if (t === "left") return "text-left";
  if (t === "right") return "text-right";
  return "text-center";
}

function densityLayout(d: unknown): { gap: string; slot: string } {
  const t = String(d ?? "comfortable").toLowerCase();
  if (t === "compact") return { gap: "gap-4", slot: "w-20 sm:w-24" };
  if (t === "airy") return { gap: "gap-10 md:gap-12", slot: "w-28 sm:w-32 md:w-36" };
  return { gap: "gap-6 sm:gap-8", slot: "w-24 sm:w-28" };
}

function readImage(row: Record<string, unknown>): string {
  const v =
    (typeof row.image === "string" && row.image.trim() && row.image) ||
    (typeof row.src === "string" && row.src.trim() && row.src) ||
    (typeof row.imageUrl === "string" && row.imageUrl.trim() && row.imageUrl) ||
    "";
  return typeof v === "string" ? v.trim() : "";
}

function parseLogosJson(raw: unknown): LogoCloudItem[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `logo-${idx}`;
        const image = readImage(o);
        return {
          id,
          image,
          label: typeof o.label === "string" ? o.label : "",
          href: typeof o.href === "string" ? o.href : "",
        };
      })
      .filter((x): x is LogoCloudItem => x != null && Boolean(x.image));
  } catch {
    return [];
  }
}

/** Normalize `data` from registry (logos[], logosJson, or legacy l1–l4). */
export function logosFromLogoCloudData(data: Record<string, unknown>): LogoCloudItem[] {
  if (Array.isArray(data.logos)) {
    const raw = data.logos as unknown[];
    const out = raw
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `logo-${idx}`;
        const image = readImage(o);
        if (!image) return null;
        return {
          id,
          image,
          label: typeof o.label === "string" ? o.label : "",
          href: typeof o.href === "string" ? o.href : "",
        };
      })
      .filter((x): x is LogoCloudItem => x != null);
    if (out.length) return out;
  }
  const fromJson = parseLogosJson(data.logosJson);
  if (fromJson.length) return fromJson;
  const legacy: LogoCloudItem[] = [];
  for (let n = 1; n <= 4; n++) {
    const key = `l${n}`;
    const v = data[key];
    const src = typeof v === "string" ? v.trim() : "";
    if (src) legacy.push({ id: `logo-${n}`, image: src, label: "", href: "" });
  }
  return legacy;
}

function LogoCell({ item, slotClass }: { item: LogoCloudItem; slotClass: string }) {
  const alt = normalizeDisplayText(safeAltForImg(item.label, "Logo"));
  const inner = (
    <div
      className={cn(
        slotClass,
        "shrink-0 opacity-90 transition hover:opacity-100",
        item.href.trim() && "rounded-lg focus-within:ring-2 focus-within:ring-pink-500/40",
      )}
    >
      <MediaFrame src={item.image} alt={alt} className="aspect-[3/1] object-contain" />
    </div>
  );
  const h = item.href.trim();
  const label = item.label.trim() || "Logo";
  if (!h || h === "#") {
    return <div className="flex min-h-[44px] min-w-0 items-center">{inner}</div>;
  }
  const internal = h.startsWith("/") && !h.startsWith("//");
  if (internal) {
    return (
      <Link href={h} className="flex min-h-[44px] min-w-[44px] items-center justify-center" aria-label={label}>
        {inner}
      </Link>
    );
  }
  return (
    <a href={h} className="flex min-h-[44px] min-w-[44px] items-center justify-center" rel="noopener noreferrer" aria-label={label}>
      {inner}
    </a>
  );
}

export type LogoCloudBlockProps = {
  merged: MergedDesign;
  title: string;
  logos: LogoCloudItem[];
  density: unknown;
  variant: unknown;
};

/**
 * Trust / partner logo strip (`logo_cloud`). Prefer structured `logos` / `logosJson`; legacy `l1`–`l4` still supported.
 */
export function LogoCloudBlock({ merged, title, logos, density, variant }: LogoCloudBlockProps) {
  const list = logos.filter((x) => x.image.trim());
  if (list.length === 0) return null;
  const { gap, slot } = densityLayout(density);
  const justify = flexJustifyFromVariant(variant);
  const titleAlign = textAlignFromVariant(variant);
  const t = title.trim();

  return (
    <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
      {t ?
        <div className={cn("lp-section-head mb-6", titleAlign)}>
          <h2 className={mergedHeadingClassString(merged, "h2")}>{t}</h2>
        </div>
      : null}
      <div className={cn("flex w-full max-w-full flex-wrap items-center", gap, justify)}>
        {list.map((item) => (
          <LogoCell key={item.id} item={item} slotClass={slot} />
        ))}
      </div>
    </Section>
  );
}
