import React from "react";
import MediaFrame from "@/components/ui/MediaFrame";
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
import { safeAltForImg } from "@/lib/media/renderSafe";
import { normalizeDisplayText } from "@/lib/cms/displayText";

export type TestimonialItem = {
  id: string;
  quote: string;
  author: string;
  role: string;
  /** Company / source line (e.g. «Acme AS»). */
  company: string;
  /** Person or brand avatar URL. */
  image: string;
  alt: string;
  /** Optional company logo URL (separate from avatar). */
  logo: string;
};

function cn(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

function readImage(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function parseTestimonialsJson(raw: unknown): TestimonialItem[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `t-${idx}`;
        const quote = typeof o.quote === "string" ? o.quote : "";
        if (!quote.trim()) return null;
        return {
          id,
          quote,
          author: typeof o.author === "string" ? o.author : "",
          role: typeof o.role === "string" ? o.role : "",
          company: typeof o.company === "string" ? o.company : typeof o.source === "string" ? o.source : "",
          image: readImage(o, ["image", "src", "imageUrl"]),
          alt: typeof o.alt === "string" ? o.alt : "",
          logo: readImage(o, ["logo", "logoUrl", "companyLogo"]),
        };
      })
      .filter((x): x is TestimonialItem => x != null);
  } catch {
    return [];
  }
}

/** Normalize registry / legacy `data` into testimonial rows. */
export function testimonialsFromTestimonialBlockData(data: Record<string, unknown>): TestimonialItem[] {
  if (Array.isArray(data.testimonials)) {
    const raw = data.testimonials as unknown[];
    const out = raw
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `t-${idx}`;
        const quote = typeof o.quote === "string" ? o.quote : "";
        if (!quote.trim()) return null;
        return {
          id,
          quote,
          author: typeof o.author === "string" ? o.author : "",
          role: typeof o.role === "string" ? o.role : "",
          company: typeof o.company === "string" ? o.company : typeof o.source === "string" ? o.source : "",
          image: readImage(o, ["image", "src", "imageUrl"]),
          alt: typeof o.alt === "string" ? o.alt : "",
          logo: readImage(o, ["logo", "logoUrl", "companyLogo"]),
        };
      })
      .filter((x): x is TestimonialItem => x != null);
    if (out.length) return out;
  }
  const fromJson = parseTestimonialsJson(data.testimonialsJson);
  if (fromJson.length) return fromJson;
  const quote = typeof data.quote === "string" ? data.quote : "";
  const author = typeof data.author === "string" ? data.author : "";
  const role = typeof data.role === "string" ? data.role : "";
  if (!quote.trim() && !author.trim()) return [];
  const d = data as Record<string, unknown>;
  const image = readImage(d, ["image", "imageUrl", "src"]);
  const alt = typeof data.alt === "string" ? data.alt : "";
  const company = typeof data.company === "string" ? data.company : typeof data.source === "string" ? data.source : "";
  const logo = readImage(d, ["logo", "logoUrl", "companyLogo"]);
  return [
    {
      id: "t-1",
      quote,
      author,
      role,
      company,
      image,
      alt,
      logo,
    },
  ];
}

function textAlignFromVariant(v: unknown): string {
  const t = String(v ?? "center").toLowerCase();
  if (t === "left") return "text-left";
  if (t === "right") return "text-right";
  return "text-center";
}

function densityGap(d: unknown): string {
  const x = String(d ?? "comfortable").toLowerCase();
  if (x === "compact") return "gap-4";
  if (x === "airy") return "gap-10";
  return "gap-6";
}

export type TestimonialBlockProps = {
  merged: MergedDesign;
  designSettings: ParsedDesignSettings | null;
  sectionTitle: string;
  items: TestimonialItem[];
  density: unknown;
  variant: unknown;
};

function OneTestimonial({
  merged,
  ds,
  it,
  layout,
}: {
  merged: MergedDesign;
  ds: ParsedDesignSettings | null;
  it: TestimonialItem;
  layout: "single" | "grid";
}) {
  const hasAvatar = Boolean(it.image.trim());
  const hasLogo = Boolean(it.logo.trim());
  const quote = it.quote.trim();
  const author = it.author.trim();
  const role = it.role.trim();
  const company = it.company.trim();
  const isSingle = layout === "single";

  return (
    <figure
      className={cn(
        cardSurfaceClassString(resolvedCardForBlockType("cards", merged.card, ds)),
        "flex flex-col items-center gap-6 p-8 text-center",
        isSingle && "md:flex-row md:text-left",
        !isSingle && "h-full",
      )}
    >
      {hasAvatar ?
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-[rgba(var(--lp-border),0.6)]">
          <MediaFrame
            src={it.image}
            alt={normalizeDisplayText(safeAltForImg(it.alt, author))}
            className="aspect-square min-h-[96px] rounded-full"
          />
        </div>
      : null}
      <div className="min-w-0 flex-1 space-y-2">
        <TextBlock className={cn(mergedBodyClassString(merged, { measure: true }), "text-lg font-medium")}>«{quote}»</TextBlock>
        <figcaption>
          {author ? <div className={mergedHeadingClassString(merged, "h3")}>{author}</div> : null}
          {role ? <div className="text-sm text-[rgb(var(--lp-muted))]">{role}</div> : null}
          {company ? <div className="text-xs text-[rgb(var(--lp-muted))]">{company}</div> : null}
        </figcaption>
        {hasLogo ?
          <div className={cn("mt-4 flex", isSingle ? "justify-center md:justify-start" : "justify-center")}>
            <div className="h-10 w-28 shrink-0 opacity-80">
              <MediaFrame src={it.logo} alt="" className="h-full w-full object-contain object-left" />
            </div>
          </div>
        : null}
      </div>
    </figure>
  );
}

/**
 * Trust testimonials (`testimonial_block`): one or more quotes with attribution, optional avatar and company logo.
 * Distinct from `quote_block` (pull quote) and generic `cards`.
 */
export function TestimonialBlock({ merged, designSettings, sectionTitle, items, density, variant }: TestimonialBlockProps) {
  const ds = designSettings;
  const list = items.filter((x) => x.quote.trim());
  if (list.length === 0) return null;
  const ta = textAlignFromVariant(variant);
  const st = sectionTitle.trim();
  const single = list.length === 1;
  const grid = cn(
    "grid w-full max-w-full",
    single ? "" : "md:grid-cols-2",
    !single && list.length > 2 ? "lg:grid-cols-3" : "",
    densityGap(density),
  );

  return (
    <Section sectionClassName={marketingSectionClassString(merged, { motion: true })} containerClassName={marketingContainerClassString(merged)}>
      {st ?
        <div className={cn("lp-section-head mb-6", ta)}>
          <h2 className={mergedHeadingClassString(merged, "h2")}>{st}</h2>
        </div>
      : null}
      <div className={single ? "" : grid}>
        {single ?
          <OneTestimonial merged={merged} ds={ds} it={list[0]!} layout="single" />
        : list.map((it) => <OneTestimonial key={it.id} merged={merged} ds={ds} it={it} layout="grid" />)}
      </div>
    </Section>
  );
}
