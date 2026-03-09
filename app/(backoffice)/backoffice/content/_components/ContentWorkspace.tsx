// app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getForsideBody,
  getBlockLabel,
  isForside,
  formatDateTimeNO,
  tryParseBlockListFromBody,
  documentTypes,
  getDocType,
  parseBodyEnvelope,
  serializeBodyEnvelope,
  BlockAddModal,
  BlockEditModal,
  validateModel,
  Editor2Shell,
  MediaPickerModal,
  type BlockList,
  type BlockNode,
  type BlockType as AddModalBlockType,
} from "./_stubs";
import type { BlockDefinition } from "./blockRegistry";
import type { SupportSnapshot, StatusLineState } from "./types";
import { applyAIPatchV1 } from "@/lib/cms/model/applyAIPatch";
import { isAIPatchV1 } from "@/lib/cms/model/aiPatch";
import { BlockPickerOverlay } from "./BlockPickerOverlay";
import { ContentTopbar } from "./ContentTopbar";
import { ContentInfoPanel } from "./ContentInfoPanel";
import { ContentSaveBar } from "./ContentSaveBar";
import { ContentAiTools } from "./ContentAiTools";
import { logEditorAiEvent } from "@/domain/backoffice/ai/metrics/logEditorAiEvent";
import type { EditorAiFeature } from "@/domain/backoffice/ai/metrics/editorAiMetricsTypes";

type PageStatus = "draft" | "published";

type SaveState =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "conflict"
  | "offline"
  | "error";

function looksMojibakeText(s: string): boolean {
  return /Ã.|Â.|Ãƒ/.test(s);
}

function looksMojibakeAny(value: unknown): boolean {
  try {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    return looksMojibakeText(str);
  } catch {
    return false;
  }
}

function makeRidClient(): string {
  try {
    if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
      return `rid_${(crypto as any).randomUUID()}`;
    }
  } catch {
    // ignore
  }
  return `rid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

const OUTBOX_KEY_PREFIX = "lp.backoffice.outbox.content.v1:";

function getOutboxKey(pageId: string): string {
  return OUTBOX_KEY_PREFIX + pageId;
}

type OutboxDraft = {
  title: string;
  slug: string;
  status: PageStatus;
  body: string;
};

type OutboxEntry = {
  pageId: string;
  savedAtLocal: string;
  updatedAtSeen: string | null;
  draft: OutboxDraft;
  fingerprint: string;
};

function readOutbox(pageId: string): OutboxEntry | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(getOutboxKey(pageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || !(parsed as Record<string, unknown>).pageId || !(parsed as Record<string, unknown>).draft) return null;
    const o = parsed as OutboxEntry;
    return o;
  } catch {
    return null;
  }
}

function writeOutbox(entry: OutboxEntry): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(getOutboxKey(entry.pageId), JSON.stringify(entry));
  } catch {
    // ignore
  }
}

function clearOutbox(pageId: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(getOutboxKey(pageId));
  } catch {
    // ignore
  }
}

// E1.3 – outbox feedback key hardening
function getOutboxEntryKey(entry: { id?: string; rid?: string; savedAtLocal?: string; pageId?: string }): string {
  if (entry.id != null && String(entry.id).trim() !== "") return String(entry.id);
  if (entry.rid != null && String(entry.rid).trim() !== "") return String(entry.rid);
  if (entry.savedAtLocal != null && String(entry.savedAtLocal).trim() !== "") return String(entry.savedAtLocal);
  return `${entry.pageId ?? "no_page"}:${entry.savedAtLocal ?? "na"}`;
}

// E1.3 – payloadBytes hardening
function safeJsonBytes(value: unknown): number | null {
  try {
    return JSON.stringify(value).length;
  } catch {
    return null;
  }
}

// E2 – outbox status per item (kun eksisterende felter)
type OutboxUiStatus = "pending" | "failed" | "retrying";
// E2.4 – hardening: vis kun Failed/Retrying hvis statusfelter faktisk finnes på entry
function getOutboxUiStatus(entry: unknown): { key: OutboxUiStatus; label: string; tone: "neutral" | "warn" | "danger" } {
  if (entry == null || typeof entry !== "object") {
    return { key: "pending", label: "Pending", tone: "neutral" };
  }
  const e = entry as Record<string, unknown>;
  const hasStatusFields =
    "status" in e ||
    "state" in e ||
    "isRetrying" in e ||
    "inFlight" in e ||
    "lastError" in e ||
    "errorMessage" in e ||
    "failureReason" in e;
  if (!hasStatusFields) {
    return { key: "pending", label: "Pending", tone: "neutral" };
  }
  if (
    ("isRetrying" in e && e.isRetrying === true) ||
    ("inFlight" in e && e.inFlight === true) ||
    ("state" in e && String(e.state ?? "") === "retrying") ||
    ("status" in e && String(e.status ?? "") === "retrying")
  ) {
    return { key: "retrying", label: "Retrying", tone: "warn" };
  }
  if (
    ("lastError" in e && String(e.lastError ?? "").trim().length > 0) ||
    ("errorMessage" in e && String(e.errorMessage ?? "").trim().length > 0) ||
    ("failureReason" in e && String(e.failureReason ?? "").trim().length > 0) ||
    ("state" in e && String(e.state ?? "") === "failed") ||
    ("status" in e && (String(e.status ?? "") === "failed" || String(e.status ?? "") === "error"))
  ) {
    return { key: "failed", label: "Failed", tone: "danger" };
  }
  return { key: "pending", label: "Pending", tone: "neutral" };
}

type ContentPageListItem = {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  updated_at: string | null;
};

type ContentPage = {
  id: string;
  title: string;
  slug: string;
  body: unknown;
  status: PageStatus;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

type ListData = {
  items: ContentPageListItem[];
};

type CreateData = {
  page: {
    id: string;
    title: string;
    slug: string;
    status: PageStatus;
  };
};

type PageData = {
  page: ContentPage;
};

type ApiOk<T> = {
  ok: true;
  rid: string;
  data: T;
};

type ApiErr = {
  ok: false;
  rid: string;
  error: string;
  message: string;
  status: number;
};

type ApiResponse<T> = ApiOk<T> | ApiErr;

type HeroBlock = {
  id: string;
  type: "hero";
  title: string;
  subtitle?: string;
  imageUrl?: string;
  imageAlt?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

type RichTextBlock = {
  id: string;
  type: "richText";
  heading?: string;
  body: string;
};

type ImageBlock = {
  id: string;
  type: "image";
  assetPath: string;
  alt?: string;
  caption?: string;
};

type CtaBlock = {
  id: string;
  type: "cta";
  title: string;
  body?: string;
  buttonLabel?: string;
  buttonHref?: string;
};

type DividerBlock = {
  id: string;
  type: "divider";
  style?: "line" | "space";
};

type BannerItemButton = { label: string; href: string };
type BannerItem = {
  id: string;
  imageUrl?: string;
  videoSource?: "youtube" | "vimeo" | "mp4";
  videoUrl?: string;
  heading?: string;
  secondaryHeading?: string;
  text?: string;
  buttons?: BannerItemButton[];
  // Settings (Layout)
  bannerStyle?: "takeover" | "medium" | "short" | "scale";
  backgroundColor?: string;
  scrollPrompt?: boolean;
  textAlignment?: "left" | "center" | "right";
  textPosition?: string;
  imageOpacity?: boolean;
  // Settings (Animation)
  animate?: boolean;
  // Settings (Advanced)
  name?: string;
  anchorName?: string;
  customClasses?: string;
  hideFromWebsite?: boolean;
};
type BannersBlock = {
  id: string;
  type: "banners";
  items: BannerItem[];
};

type CodeBlock = {
  id: string;
  type: "code";
  code: string;
  displayIntro?: boolean;
  displayOutro?: boolean;
};

type Block = HeroBlock | RichTextBlock | ImageBlock | CtaBlock | DividerBlock | BannersBlock | CodeBlock;
type BlockType = Block["type"];

type BodyMode = "blocks" | "legacy" | "invalid";

type BodyParseResult = {
  mode: BodyMode;
  blocks: Block[];
  meta: Record<string, unknown>;
  legacyText: string;
  rawBody: string;
  error: string | null;
};

type AiToolId =
  | "landing.generate.sections"
  | "seo.optimize.page"
  | "content.maintain.page"
  | "experiment.generate.variants"
  | "image.generate.brand_safe"
  | "image.improve.metadata"
  | "i18n.translate.blocks"
  | "block.builder";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeObj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function buildAiBlocks(
  blocks: Block[]
): Array<{ id: Block["id"]; type: Block["type"]; data?: Record<string, unknown> }> {
  return blocks.map((b: Block) => {
    switch (b.type) {
      case "hero": {
        const { id, type, title, subtitle, imageUrl, imageAlt, ctaLabel, ctaHref } = b;
        return { id, type, data: { title, subtitle, imageUrl, imageAlt, ctaLabel, ctaHref } };
      }
      case "richText": {
        const { id, type, heading, body } = b;
        return { id, type, data: { heading, body } };
      }
      case "image": {
        const { id, type, assetPath, alt, caption } = b;
        return { id, type, data: { assetPath, alt, caption } };
      }
      case "cta": {
        const { id, type, title, body, buttonLabel, buttonHref } = b;
        return { id, type, data: { title, body, buttonLabel, buttonHref } };
      }
      case "banners": {
        const { id, type, items } = b;
        return { id, type, data: { items } };
      }
      case "divider": {
        const { id, type, style } = b;
        return { id, type, data: { style } };
      }
      case "code": {
        const { id, type, code, displayIntro, displayOutro } = b;
        return { id, type, data: { code, displayIntro, displayOutro } };
      }
      default: {
        const neverBlock: never = b;
        return { id: (neverBlock as Block).id, type: (neverBlock as Block).type };
      }
    }
  });
}

function buildAiExistingBlocks(blocks: Block[]): Array<{ id: string; type: string }> {
  return blocks.map((b) => ({ id: b.id, type: b.type }));
}

function buildAiMeta(meta: Record<string, unknown>): { description?: string } | undefined {
  const root = safeObj(meta);
  const seo = safeObj((root as { seo?: unknown }).seo);
  const descriptionRaw = (seo as { description?: unknown }).description;
  const description = typeof descriptionRaw === "string" ? descriptionRaw : undefined;
  if (description && description.trim()) {
    return { description: description.trim() };
  }
  return undefined;
}

function normalizeSlug(v: unknown): string {
  return safeStr(v)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(v: string | null | undefined): string {
  const raw = safeStr(v);
  if (!raw) return "-";
  return formatDateTimeNO(raw) || raw;
}

function extractAiSummary(tool: AiToolId, data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.summary === "string" && o.summary.trim()) {
    return o.summary.trim();
  }
  if (tool === "experiment.generate.variants") {
    if (Array.isArray(o.variants)) {
      const count = o.variants.length;
      return count > 0
        ? `Genererte ${count} A/B-variant${count === 1 ? "" : "er"}.`
        : "Ingen A/B-varianter generert.";
    }
    if (Array.isArray(o.suggestionIds)) {
      const count = o.suggestionIds.length;
      return count > 0
        ? `Genererte ${count} A/B-variant${count === 1 ? "" : "er"}.`
        : "Ingen A/B-varianter generert.";
    }
  }
  if (tool === "image.generate.brand_safe" && Array.isArray(o.candidates)) {
    const count = o.candidates.length;
    return count > 0
      ? `Genererte ${count} bildeforslag i mediearkivet.`
      : "Ingen bildeforslag generert.";
  }
  if (tool === "image.improve.metadata") {
    return "Forslag til bilde-metadata er klare i AI-forslaget.";
  }
  return null;
}

// I1 – pure mapper: state – statuslinje (prioritet: conflict > offline > error > saving > unsaved > saved)
function getStatusLineState(params: {
  saveState: SaveState;
  dirty: boolean;
  isOffline: boolean;
  lastSavedAt: string | null;
  lastError: string | null;
  formatDateFn: (v: string | null | undefined) => string;
}): { key: string; tone: string; label: string; detail?: string; actions: { retry?: boolean; reload?: boolean } } {
  const { saveState, dirty, isOffline, lastSavedAt, lastError, formatDateFn } = params;
  if (saveState === "conflict") return { key: "conflict", tone: "border-amber-300 bg-amber-50 text-amber-800", label: "Konflikt – last på nytt", actions: { reload: true } };
  if (saveState === "offline" || isOffline) return { key: "offline", tone: "border-slate-300 bg-slate-50 text-slate-700", label: "Offline – lagres lokalt", actions: {} };
  if (saveState === "error") return { key: "error", tone: "border-amber-300 bg-amber-50 text-amber-800", label: "Feil – prøv igjen", actions: { retry: true } };
  if (saveState === "saving") return { key: "saving", tone: "border-slate-300 bg-slate-50 text-slate-700", label: "Lagrer…", actions: {} };
  if (dirty || saveState === "dirty") return { key: "unsaved", tone: "border-amber-200 bg-amber-50/80 text-amber-800", label: "Ulagrede endringer", actions: {} };
  return { key: "saved", tone: "border-green-200 bg-green-50/80 text-green-800", label: "Lagret", detail: lastSavedAt ? `Sist lagret ${formatDateFn(lastSavedAt)}` : undefined, actions: {} };
}

function makeSnapshot(input: {
  title: string;
  slug: string;
  body: string;
}): string {
  return JSON.stringify({
    title: safeStr(input.title),
    slug: normalizeSlug(input.slug),
    body: String(input.body ?? ""),
  });
}

function readApiMessage<T>(payload: ApiResponse<T> | null | undefined): string {
  if (payload && payload.ok === false) return safeStr(payload.message);
  return "";
}

function readApiRid<T>(payload: ApiResponse<T> | null | undefined): string {
  if (!payload) return "";
  return safeStr((payload as { rid?: unknown }).rid);
}

function readApiError<T>(
  status: number,
  payload: ApiResponse<T> | null | undefined,
  fallback: string
): string {
  const message = readApiMessage(payload);
  if (message) return message;

  const rid = readApiRid(payload);
  const withRid = (text: string) => (rid ? `${text} (rid: ${rid})` : text);

  if (status === 401) return withRid("Ikke innlogget.");
  if (status === 403) return withRid("Ingen tilgang.");
  if (status === 404) return withRid("Fant ikke side.");
  if (status === 409) return withRid("Slug er allerede i bruk.");
  return withRid(fallback);
}

async function parseJsonSafe<T>(res: Response): Promise<ApiResponse<T> | null> {
  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return null;
  }
}

function statusTone(status: PageStatus): string {
  return status === "published"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-900";
}

function makeBlockId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `blk_${crypto.randomUUID()}`;
  }
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createBlock(type: BlockType): Block {
  const id = makeBlockId();

  if (type === "hero") {
    return { id, type, title: "", subtitle: "", imageUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "" };
  }

  if (type === "richText") {
    return { id, type, heading: "", body: "" };
  }

  if (type === "image") {
    return { id, type, assetPath: "", alt: "", caption: "" };
  }

  if (type === "cta") {
    return { id, type, title: "", body: "", buttonLabel: "", buttonHref: "" };
  }

  if (type === "banners") {
    return { id, type, items: [] };
  }

  if (type === "code") {
    return { id, type, code: "", displayIntro: false, displayOutro: false };
  }

  return { id, type: "divider" as const };
}

// Local guard to ensure only known block types are passed from overlay (fail-closed)
function isAddModalBlockTypeFromOverlay(type: string): type is BlockType {
  return (
    type === "hero" ||
    type === "richText" ||
    type === "image" ||
    type === "cta" ||
    type === "banners" ||
    type === "code" ||
    type === "divider"
  );
}

function blockTypeSubtitle(type: BlockType, block?: Block): string {
  const upper = type === "richText" ? "RICH TEXT" : type.toUpperCase().replace(/([a-z])([A-Z])/g, "$1 $2");
  if (type === "banners" && block && block.type === "banners") {
    const n = block.items?.length ?? 0;
    return `COMPONENT: BANNERS · ITEMS: ${n}`;
  }
  if (type === "code") return "COMPONENT: CODE";
  return `COMPONENT: ${upper}`;
}

function LayoutThumbnail({ layout }: { layout: "full" | "left" | "right" | "centerNavLeft" | "centerNavRight" }) {
  const base = "rounded-sm bg-slate-300";
  const main = "rounded-sm bg-slate-500";
  if (layout === "full") {
    return <div className={`h-10 w-14 ${main}`} />;
  }
  if (layout === "left") {
    return (
      <div className="flex h-10 w-14 gap-0.5">
        <div className={`w-3 ${base}`} />
        <div className={`flex-1 ${main}`} />
      </div>
    );
  }
  if (layout === "right") {
    return (
      <div className="flex h-10 w-14 gap-0.5">
        <div className={`flex-1 ${main}`} />
        <div className={`w-3 ${base}`} />
      </div>
    );
  }
  if (layout === "centerNavLeft") {
    return (
      <div className="flex h-10 w-14 gap-0.5">
        <div className={`w-2 ${base}`} />
        <div className={`flex-1 ${main}`} />
      </div>
    );
  }
  if (layout === "centerNavRight") {
    return (
      <div className="flex h-10 w-14 gap-0.5">
        <div className={`flex-1 ${main}`} />
        <div className={`w-2 ${base}`} />
      </div>
    );
  }
  return <div className={`h-10 w-14 ${main}`} />;
}

/** Live forhåndsvisning av siden som den vil se ut på Lunchportalen (gjeldende blokker). U1 – preview as secondary. */
function LivePreviewPanel({
  pageTitle,
  blocks,
  pageId = null,
  variantId = null,
}: {
  pageTitle: string;
  blocks: Block[];
  pageId?: string | null;
  variantId?: string | null;
}) {
  return (
    <aside className="lg:sticky lg:top-4 h-fit rounded-lg border-0 bg-transparent p-0" aria-label="Live forhåndsvisning av siden">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Lunchportalen</div>
      <div className="mx-auto max-w-md space-y-3 rounded-lg border border-[rgb(var(--lp-border))] bg-white/90 p-3">
        {pageTitle ? <h1 className="text-xl font-semibold text-[rgb(var(--lp-text))]">{pageTitle}</h1> : null}
        {blocks.length === 0 ? (
          <p className="text-sm text-[rgb(var(--lp-muted))]">Inår du legger til innhold.</p>
        ) : (
          <div className="space-y-4">
            {blocks.map((block, index) => {
              if (block.type === "hero") {
                return (
                  <section key={block.id} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white overflow-hidden">
                    {block.imageUrl ? (
                      <div className="aspect-[21/9] w-full bg-slate-100">
                        <img src={block.imageUrl} alt={block.imageAlt ?? ""} className="h-full w-full object-cover" />
                      </div>
                    ) : null}
                    <div className="p-4">
                      {block.title ? <h2 className="text-lg font-semibold text-[rgb(var(--lp-text))]">{block.title}</h2> : null}
                      {block.subtitle ? <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{block.subtitle}</p> : null}
                      {block.ctaLabel && block.ctaHref ? (
                        <a
                          href={block.ctaHref}
                          className="mt-2 inline-block rounded-lg bg-black px-3 py-1.5 text-sm text-white"
                          data-analytics-cta-id={block.id}
                          data-analytics-page-id={pageId ?? undefined}
                          data-analytics-variant-id={variantId ?? undefined}
                        >
                          {block.ctaLabel}
                        </a>
                      ) : null}
                    </div>
                  </section>
                );
              }
              if (block.type === "richText") {
                return (
                  <section key={block.id} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
                    {block.heading ? <h2 className="text-base font-semibold text-[rgb(var(--lp-text))]">{block.heading}</h2> : null}
                    {block.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-[rgb(var(--lp-text))]">{block.body}</p> : null}
                  </section>
                );
              }
              if (block.type === "image") {
                const src = block.assetPath?.startsWith("/") ? block.assetPath : `/${block.assetPath}`;
                return (
                  <figure key={block.id} className="rounded-xl border border-[rgb(var(--lp-border))]">
                    {block.assetPath ? <img src={src} alt={block.alt || ""} className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center bg-slate-100 text-sm text-[rgb(var(--lp-muted))]">Bilde</div>}
                    {block.caption ? <figcaption className="p-2 text-xs text-[rgb(var(--lp-muted))]">{block.caption}</figcaption> : null}
                  </figure>
                );
              }
              if (block.type === "cta") {
                return (
                  <section key={block.id} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
                    {block.title ? <h2 className="text-base font-semibold text-[rgb(var(--lp-text))]">{block.title}</h2> : null}
                    {block.body ? <p className="mt-1 text-sm text-[rgb(var(--lp-text))]">{block.body}</p> : null}
                    {block.buttonLabel && block.buttonHref ? (
                      <a
                        href={block.buttonHref}
                        className="mt-2 inline-block rounded-lg bg-black px-3 py-1.5 text-sm text-white"
                        data-analytics-cta-id={block.id}
                        data-analytics-page-id={pageId ?? undefined}
                        data-analytics-variant-id={variantId ?? undefined}
                      >
                        {block.buttonLabel}
                      </a>
                    ) : null}
                  </section>
                );
              }
              if (block.type === "banners") {
                return (
                  <section key={block.id} className="space-y-2">
                    {block.items.length === 0 ? <div className="rounded-xl border border-dashed border-[rgb(var(--lp-border))] py-6 text-center text-sm text-[rgb(var(--lp-muted))]">Banners (tom)</div> : block.items.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white">
                        {item.imageUrl ? <img src={item.imageUrl} alt="" className="aspect-[21/9] w-full object-cover" /> : <div className="flex aspect-[21/9] items-center justify-center bg-slate-100 text-sm text-[rgb(var(--lp-muted))]">Banner</div>}
                        <div className="p-2">
                          {item.heading ? <p className="font-medium text-[rgb(var(--lp-text))]">{item.heading}</p> : null}
                          {item.secondaryHeading ? <p className="text-xs text-[rgb(var(--lp-muted))]">{item.secondaryHeading}</p> : null}
                          {(item.buttons?.length ?? 0) > 0 ? item.buttons!.map((b, i) => b.href ? <a key={i} href={b.href} className="mr-2 inline-block rounded bg-black px-2 py-1 text-xs text-white">{b.label || "Lenke"}</a> : null) : null}
                        </div>
                      </div>
                    ))}
                  </section>
                );
              }
              if (block.type === "code") {
                return (
                  <section key={block.id} className="rounded-xl border border-[rgb(var(--lp-border))] bg-slate-900 p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Kode</p>
                    {block.code ? <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-200">{block.code}</pre> : <p className="text-xs text-slate-500">Ingen kode</p>}
                  </section>
                );
              }
              if (block.type === "divider") {
                return <hr key={block.id} className="border-[rgb(var(--lp-border))]" />;
              }
              return <hr key={(block as Block).id} className="border-[rgb(var(--lp-border))]" />;
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function normalizeBlock(raw: unknown): Block | null {
  const row = safeObj(raw);
  const type = safeStr(row.type) as BlockType;
  const id = safeStr(row.id) || makeBlockId();

  if (type === "hero") {
    return {
      id,
      type,
      title: safeStr(row.title),
      subtitle: safeStr(row.subtitle),
      imageUrl: safeStr(row.imageUrl) || undefined,
      imageAlt: safeStr(row.imageAlt) || undefined,
      ctaLabel: safeStr(row.ctaLabel),
      ctaHref: safeStr(row.ctaHref),
    };
  }

  if (type === "richText") {
    return {
      id,
      type,
      heading: safeStr(row.heading),
      body: safeStr(row.body),
    };
  }

  if (type === "image") {
    return {
      id,
      type,
      assetPath: safeStr(row.assetPath),
      alt: safeStr(row.alt),
      caption: safeStr(row.caption),
    };
  }

  if (type === "cta") {
    return {
      id,
      type,
      title: safeStr(row.title),
      body: safeStr(row.body),
      buttonLabel: safeStr(row.buttonLabel),
      buttonHref: safeStr(row.buttonHref),
    };
  }

  if (type === "divider") {
    const style = safeStr(row.style) === "space" ? "space" : undefined;
    return { id, type, ...(style ? { style } as const : {}) };
  }

  if (type === "code") {
    return {
      id,
      type: "code",
      code: safeStr(row.code),
      displayIntro: row.displayIntro === true,
      displayOutro: row.displayOutro === true,
    };
  }

  if (type === "banners") {
    const rawItems = Array.isArray(row.items) ? row.items : [];
    const items: BannerItem[] = rawItems.map((raw: unknown) => {
      const r = safeObj(raw);
      const buttonsRaw = Array.isArray(r.buttons) ? r.buttons : [];
      const buttons: BannerItemButton[] = buttonsRaw.map((b: unknown) => {
        const x = safeObj(b);
        return { label: safeStr(x.label), href: safeStr(x.href) };
      });
      return {
        id: safeStr(r.id) || makeBlockId(),
        imageUrl: safeStr(r.imageUrl) || undefined,
        videoSource: (safeStr(r.videoSource) as "youtube" | "vimeo" | "mp4") || undefined,
        videoUrl: safeStr(r.videoUrl) || undefined,
        heading: safeStr(r.heading) || undefined,
        secondaryHeading: safeStr(r.secondaryHeading) || undefined,
        text: safeStr(r.text) || undefined,
        buttons: buttons.length ? buttons : undefined,
        bannerStyle: (safeStr(r.bannerStyle) as "takeover" | "medium" | "short" | "scale") || undefined,
        backgroundColor: safeStr(r.backgroundColor) || undefined,
        scrollPrompt: r.scrollPrompt === true,
        textAlignment: (safeStr(r.textAlignment) as "left" | "center" | "right") || undefined,
        textPosition: safeStr(r.textPosition) || undefined,
        imageOpacity: r.imageOpacity === true,
        animate: r.animate === true,
        name: safeStr(r.name) || undefined,
        anchorName: safeStr(r.anchorName) || undefined,
        customClasses: safeStr(r.customClasses) || undefined,
        hideFromWebsite: r.hideFromWebsite === true,
      };
    });
    return { id, type, items };
  }

  return null;
}

function normalizeBlocks(raw: unknown): Block[] {
  const source = Array.isArray(raw) ? raw : [];
  return source.map(normalizeBlock).filter((b): b is Block => Boolean(b));
}

function looksJsonLike(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function toRawBodyString(body: unknown): string {
  if (typeof body === "string") return body;
  if (body === null || body === undefined) return "";
  try {
    return JSON.stringify(body);
  } catch {
    return String(body ?? "");
  }
}

function parseBodyToBlocks(body: unknown): BodyParseResult {
  const rawBody = toRawBodyString(body);

  if (body === null || body === undefined) {
    return {
      mode: "legacy",
      blocks: [],
      meta: {},
      legacyText: "",
      rawBody,
      error: null,
    };
  }

  if (typeof body === "object" && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;
    const meta = safeObj(obj.meta);

    if (!Array.isArray(obj.blocks)) {
      return {
        mode: "invalid",
        blocks: [],
        meta,
        legacyText: "",
        rawBody,
        error: "Invalid body format.",
      };
    }

    return {
      mode: "blocks",
      blocks: normalizeBlocks(obj.blocks),
      meta,
      legacyText: "",
      rawBody,
      error: null,
    };
  }

  if (typeof body === "string") {
    if (!looksJsonLike(body)) {
      return {
        mode: "legacy",
        blocks: [],
        meta: {},
        legacyText: body,
        rawBody: body,
        error: null,
      };
    }

    try {
      const parsed = JSON.parse(body) as unknown;

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          mode: "invalid",
          blocks: [],
          meta: {},
          legacyText: "",
          rawBody: body,
          error: "Invalid body format.",
        };
      }

      const obj = parsed as Record<string, unknown>;
      const meta = safeObj(obj.meta);

      if (!Array.isArray(obj.blocks)) {
        return {
          mode: "invalid",
          blocks: [],
          meta,
          legacyText: "",
          rawBody: body,
          error: "Invalid body format.",
        };
      }

      return {
        mode: "blocks",
        blocks: normalizeBlocks(obj.blocks),
        meta,
        legacyText: "",
        rawBody: body,
        error: null,
      };
    } catch {
      return {
        mode: "invalid",
        blocks: [],
        meta: {},
        legacyText: "",
        rawBody: body,
        error: "Invalid body format.",
      };
    }
  }

  return {
    mode: "invalid",
    blocks: [],
    meta: {},
    legacyText: "",
    rawBody,
    error: "Invalid body format.",
  };
}

function serializeBlocksToBody(blocks: Block[], meta: Record<string, unknown>): string {
  return JSON.stringify({ blocks, meta });
}

function deriveBodyForSave(
  mode: BodyMode,
  blocks: Block[],
  meta: Record<string, unknown>,
  legacyText: string,
  invalidRaw: string
): string {
  if (mode === "blocks") return serializeBlocksToBody(blocks, meta);
  if (mode === "legacy") return legacyText;
  return invalidRaw;
}

function deriveBodyFromParse(parsed: BodyParseResult): string {
  return deriveBodyForSave(
    parsed.mode,
    parsed.blocks,
    parsed.meta,
    parsed.legacyText,
    parsed.rawBody
  );
}

export function ContentWorkspace({
  initialPageId,
  embedded = false,
}: {
  initialPageId?: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const hideLegacySidebar = embedded === true;
  const selectedId = safeStr(initialPageId);
  const hjemSingleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ContentPageListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listReloadKey, setListReloadKey] = useState(0);
  const [hjemExpanded, setHjemExpanded] = useState(true);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [createPanelMode, setCreatePanelMode] = useState<"choose" | "form">("choose");
  const [mainView, setMainView] = useState<"page" | "global" | "design">("page");
  const [globalPanelTab, setGlobalPanelTab] = useState<"global" | "content" | "info">("global");
  const [globalSubView, setGlobalSubView] = useState<
    null | "content-and-settings" | "header" | "navigation" | "footer" | "reusable-components"
  >(null);
  const [headerVariant, setHeaderVariant] = useState<
    null | "public" | "company-admin" | "superadmin" | "employee" | "kitchen" | "driver"
  >(null);
  const [headerEditConfig, setHeaderEditConfig] = useState<{ title: string; nav: Array<{ label: string; href: string; exact?: boolean }> } | null>(null);
  const [headerEditLoading, setHeaderEditLoading] = useState(false);
  const [headerEditSaving, setHeaderEditSaving] = useState(false);
  const [headerEditError, setHeaderEditError] = useState<string | null>(null);
  const [contentSettingsTab, setContentSettingsTab] = useState<
    "general" | "analytics" | "form" | "shop" | "globalContent" | "notification" | "scripts" | "advanced"
  >("general");
  const [navigationTab, setNavigationTab] = useState<
    "main" | "secondary" | "footer" | "member" | "cta" | "language" | "advanced"
  >("main");
  const [hideMainNavigation, setHideMainNavigation] = useState(false);
  const [hideSecondaryNavigation, setHideSecondaryNavigation] = useState(false);
  const [hideFooterNavigation, setHideFooterNavigation] = useState(false);
  const [hideMemberNavigation, setHideMemberNavigation] = useState(false);
  const [hideCtaNavigation, setHideCtaNavigation] = useState(false);
  const [hideLanguageNavigation, setHideLanguageNavigation] = useState(true);
  const [multilingualMode, setMultilingualMode] = useState<"multiSite" | "oneToOne">("oneToOne");
  const [footerTab, setFooterTab] = useState<"content" | "advanced">("content");
  const [designTab, setDesignTab] = useState<
    "Layout" | "Logo" | "Colors" | "Spacing" | "Fonts" | "Backgrounds" | "CSS" | "JavaScript" | "Advanced"
  >("Layout");
  const [colorsContentBg, setColorsContentBg] = useState("#f5d385");
  const [colorsButtonBg, setColorsButtonBg] = useState("#f8e7a0");
  const [colorsButtonText, setColorsButtonText] = useState("#000000");
  const [colorsButtonBorder, setColorsButtonBorder] = useState("#6e5338");
  const [labelColors, setLabelColors] = useState<
    Array<{ background: string; text: string }>
  >([
    { background: "#dc2626", text: "#ffffff" },
    { background: "#b91c1c", text: "#ffffff" },
    { background: "#ec4899", text: "#ffffff" },
    { background: "#dc2626", text: "#ffffff" },
    { background: "#ef4444", text: "#000000" },
    { background: "#f97316", text: "#000000" },
  ]);
  const [contentDirection, setContentDirection] = useState<"ltr" | "rtl">("ltr");
  const [emailPlatform, setEmailPlatform] = useState<"campaignMonitor" | "mailchimp" | null>("mailchimp");
  const [captchaVersion, setCaptchaVersion] = useState<"recaptchaV2" | "recaptchaV3" | "hcaptcha" | "turnstile">(
    "hcaptcha"
  );
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  const [createTitle, setCreateTitle] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createSlugTouched, setCreateSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  /** Umbraco Core Patch A: chosen child DocumentType alias when creating. */
  const [createDocumentTypeAlias, setCreateDocumentTypeAlias] = useState<string | null>(null);
  /** Allowed child types from parent's DocumentType (fetched when create panel opens). */
  const [allowedChildTypes, setAllowedChildTypes] = useState<string[]>([]);
  const [createParentLoading, setCreateParentLoading] = useState(false);

  const [selectedBannerItemId, setSelectedBannerItemId] = useState<string | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<{ blockId: string; itemId?: string; field: "imageUrl" | "videoUrl" | "heroImageUrl" } | null>(null);
  const [bannerPanelTab, setBannerPanelTab] = useState<"content" | "settings">("content");
  const [bannerSettingsSubTab, setBannerSettingsSubTab] = useState<"layout" | "animation" | "advanced">("layout");
  const [showPreviewColumn, setShowPreviewColumn] = useState(false);

  const [page, setPage] = useState<ContentPage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pageNotFound, setPageNotFound] = useState(false);
  const [refetchDetailKey, setRefetchDetailKey] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [bodyMode, setBodyMode] = useState<BodyMode>("blocks");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [legacyBodyText, setLegacyBodyText] = useState("");
  const [invalidBodyRaw, setInvalidBodyRaw] = useState("");
  const [bodyParseError, setBodyParseError] = useState<string | null>(null);
  const [addBlockModalOpen, setAddBlockModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "innhold" | "ekstra" | "oppsummering" | "navigasjon" | "seo" | "scripts" | "avansert"
  >("innhold");

  /** Umbraco Core Patch A: DocumentType binding (body envelope when no DB column). */
  const [documentTypeAlias, setDocumentTypeAlias] = useState<string | null>(null);
  const [envelopeFields, setEnvelopeFields] = useState<Record<string, unknown>>({});

  const isContentTab = activeTab === "innhold";
  const showBlocks = bodyMode === "blocks";
  const showPreview = showBlocks && showPreviewColumn;

  /** Block List Editor 2.0 – feature flag (local, no backend). When true, render Editor2Shell. */
  const useEditor2 = false;
  const SHELL_V1 = true;
  const [editor2Model, setEditor2Model] = useState<BlockList | null>(null);
  const [editor2SelectedBlockId, setEditor2SelectedBlockId] = useState<string | null>(null);
  const [editor2FocusNonce, setEditor2FocusNonce] = useState(0);
  const [editor2ResetSearchNonce, setEditor2ResetSearchNonce] = useState(0);
  const editor2BlockListRef = useRef<HTMLDivElement | null>(null);
  const editor2PendingFocusIdRef = useRef<string | null>(null);

  const [saveState, setSaveState] = useState<SaveState>("idle");

  function setSaveStateSafe(next: SaveState): void {
    setSaveState((current) => {
      switch (current) {
        case "idle":
          if (next !== "dirty" && next !== "offline") return current;
          break;
        case "dirty":
          if (next !== "saving" && next !== "offline" && next !== "idle") return current;
          break;
        case "saving":
          if (next !== "saved" && next !== "conflict" && next !== "error" && next !== "offline") return current;
          break;
        case "saved":
          if (next !== "dirty" && next !== "idle") return current;
          break;
        case "offline":
          if (next !== "dirty" && next !== "conflict" && next !== "idle") return current;
          break;
        case "conflict":
          if (next !== "idle") return current;
          break;
        case "error":
          if (next !== "dirty" && next !== "saving" && next !== "idle") return current;
          break;
      }
      return next;
    });
  }

  const [lastServerUpdatedAt, setLastServerUpdatedAt] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [recoveryBannerVisible, setRecoveryBannerVisible] = useState(false);
  const [outboxData, setOutboxData] = useState<OutboxEntry | null>(null);
  const [outboxDetailsExpanded, setOutboxDetailsExpanded] = useState(false);
  // E1 – outbox copy feedback per item (item-scoped)
  const [outboxCopyFeedback, setOutboxCopyFeedback] = useState<Record<string, "ok" | "fail" | null>>({});
  // I4 – session rid (én per session, settes ved første behov)
  const sessionRidRef = useRef<string | null>(null);
  const [supportCopyFeedback, setSupportCopyFeedback] = useState<"ok" | "fail" | null>(null); // I4

  /** Resolved page id for API calls; when URL is slug we use page.id after load. */
  const effectiveId = page?.id ?? selectedId;

  // AI – editor-scoped state (busyId can be AiToolId or dedicated-route id e.g. layout.suggestions)
  const [aiBusyToolId, setAiBusyToolId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiBlockBuilderResult, setAiBlockBuilderResult] = useState<{
    block: Record<string, unknown>;
    message: string;
  } | null>(null);
  const [aiLastAppliedTool, setAiLastAppliedTool] = useState<string | null>(null);
  const [aiLastActionFeature, setAiLastActionFeature] = useState<EditorAiFeature | null>(null);
  type AiCapabilityStatus = "loading" | "available" | "unavailable";
  const [aiCapability, setAiCapability] = useState<AiCapabilityStatus>("loading");

  const editorOpenedLoggedForRef = useRef<string | null>(null);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outboxWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  /** Skip scheduling autosave once after initial load so we don't trigger 409 on open. */
  const skipNextAutosaveScheduleRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const performSaveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  const saveSeqRef = useRef<number>(0);
  const activeAbortRef = useRef<AbortController | null>(null);
  const statusSeqRef = useRef<number>(0);
  const statusAbortRef = useRef<AbortController | null>(null);
  const statusInProgressRef = useRef(false);
  const [isStatusInProgress, setIsStatusInProgress] = useState(false);
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);
  const addInsertIndexRef = useRef<number | null>(null);

  // Editor-AI metrics: log editor_opened once per page
  useEffect(() => {
    if (!effectiveId) {
      editorOpenedLoggedForRef.current = null;
      return;
    }
    if (editorOpenedLoggedForRef.current === effectiveId) return;
    editorOpenedLoggedForRef.current = effectiveId;
    logEditorAiEvent({
      type: "editor_opened",
      pageId: effectiveId,
      variantId: null,
      timestamp: new Date().toISOString(),
    });
  }, [effectiveId]);

  // Editor-AI capability: fetch once when a page is selected so we show loading/available/unavailable correctly
  useEffect(() => {
    if (!selectedId) {
      setAiCapability("loading");
      return;
    }
    let cancelled = false;
    setAiCapability("loading");
    fetch("/api/backoffice/ai/capability", { method: "GET", credentials: "include" })
      .then((res) => res.json().catch(() => ({})))
      .then((data: { ok?: boolean; enabled?: boolean; data?: { ok?: boolean; enabled?: boolean } }) => {
        if (cancelled) return;
        const enabled =
          typeof data.enabled === "boolean"
            ? data.enabled
            : typeof data?.data?.enabled === "boolean"
              ? data.data.enabled
              : false;
        const status: AiCapabilityStatus = enabled ? "available" : "unavailable";
        if (process.env.NODE_ENV === "development") {
          console.log("[EDITOR_AI] capability", { payload: data, enabled, status });
        }
        setAiCapability(status);
      })
      .catch(() => {
        if (!cancelled) setAiCapability("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const statusLabel = useMemo<PageStatus>(() => {
    if (!page) return "draft";
    return page.status;
  }, [page]);

  const bodyForSave = useMemo(() => {
    const blocksBody = deriveBodyForSave(bodyMode, blocks, meta, legacyBodyText, invalidBodyRaw);
    if (documentTypeAlias && documentTypeAlias.trim() !== "") {
      return serializeBodyEnvelope({
        documentType: documentTypeAlias,
        fields: envelopeFields,
        blocksBody,
      });
    }
    return blocksBody;
  }, [bodyMode, blocks, meta, legacyBodyText, invalidBodyRaw, documentTypeAlias, envelopeFields]);

  const currentSnapshot = useMemo(
    () => makeSnapshot({ title, slug, body: bodyForSave as string }),
    [title, slug, bodyForSave]
  );

  const dirty = useMemo(() => {
    if (!selectedId || !page || !savedSnapshot) return false;
    return currentSnapshot !== savedSnapshot;
  }, [selectedId, page, savedSnapshot, currentSnapshot]);

  const isPublished = statusLabel === "published";
  const isDraft = statusLabel === "draft";

  const saving = saveState === "saving";
  const hasConflict = saveState === "conflict";
  const canSave = Boolean(selectedId && page && dirty && !saving && !detailLoading && !hasConflict && !isOffline);
  const canPublish = Boolean(selectedId && page && !isPublished && !saving && !detailLoading && !isStatusInProgress && !hasConflict && !isOffline);
  const canUnpublish = Boolean(selectedId && page && !isDraft && !saving && !detailLoading && !isStatusInProgress && !hasConflict && !isOffline);

  const publicSlug = useMemo(() => {
    const raw = slug || page?.slug || "";
    const norm = normalizeSlug(raw);
    return norm || null;
  }, [slug, page?.slug]);

  const canOpenPublic = Boolean(publicSlug);

  // I2 – publish/unpublish disabled forklaring (title på knappene)
  const publishDisabledTitle =
    !canPublish && (!selectedId || !page)
      ? "Velg en side først"
      : !canPublish && hasConflict
        ? "Konflikt – last på nytt"
        : !canPublish && isOffline
          ? "Offline – kan ikke publisere"
          : !canPublish && (saving || isStatusInProgress)
            ? "Venter på lagring…"
            : !canPublish && detailLoading
              ? "Laster detaljer…"
              : undefined;
  const unpublishDisabledTitle =
    !canUnpublish && (!selectedId || !page)
      ? "Velg en side først"
      : !canUnpublish && hasConflict
        ? "Konflikt – last på nytt"
        : !canUnpublish && isOffline
          ? "Offline – kan ikke publisere"
          : !canUnpublish && (saving || isStatusInProgress)
            ? "Venter på lagring…"
            : !canUnpublish && detailLoading
              ? "Laster detaljer…"
              : undefined;

  // I1 – statusLine-useMemo (én sannhetskilde)
  const statusLine: StatusLineState = useMemo(
    () => getStatusLineState({ saveState, dirty, isOffline, lastSavedAt, lastError, formatDateFn: formatDate }),
    [saveState, dirty, isOffline, lastSavedAt, lastError]
  );

  const onOpenPublicPage = useCallback(() => {
    if (!publicSlug) return;
    if (typeof window === "undefined") return;
    const path = `/${publicSlug}`;
    window.open(path, "_blank", "noopener,noreferrer");
  }, [publicSlug]);

  // Block List Editor 2.0 – parse body to BlockList when useEditor2 and page available (read-only adapter)
  useEffect(() => {
    if (!useEditor2 || !page) return;
    const result = tryParseBlockListFromBody(page.body);
    setEditor2Model(result.ok ? result.list : { version: 1, blocks: [] });
  }, [useEditor2, page]);

  // Step 2.1 – Editor2 validation (nodes from editor2Model)
  const editor2Validation = useMemo(() => {
    if (!editor2Model?.blocks?.length) return { byId: {} as Record<string, string[]>, total: 0, firstId: null as string | null };
    return validateModel(editor2Model.blocks.map((b: BlockNode) => ({ id: b.id, type: b.type, data: b.data ?? {} })));
  }, [editor2Model]);

  // Step 2.4 – soft-mode: bump focusNonce only when selection came from list (pendingFocusIdRef)
  useEffect(() => {
    if (!useEditor2 || !editor2SelectedBlockId) return;
    if (editor2PendingFocusIdRef.current !== editor2SelectedBlockId) return;
    editor2PendingFocusIdRef.current = null;
    const errs = editor2Validation.byId[editor2SelectedBlockId] ?? [];
    const hasFieldErrors = errs.some((e) => /^[a-zA-Z0-9_]+:/.test(e));
    if (hasFieldErrors) setEditor2FocusNonce((n) => n + 1);
  }, [useEditor2, editor2SelectedBlockId, editor2Validation.byId]);

  // Step 2.9 – global Ctrl/Cmd+F when Editor2 active: focus BlockListPane and reset search
  useEffect(() => {
    if (!useEditor2) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setEditor2ResetSearchNonce((n) => n + 1);
        editor2BlockListRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [useEditor2]);

  // I4 – support snapshot (kun ved conflict/offline/error)
  const supportSnapshot: SupportSnapshot | null = useMemo(() => {
    if (statusLine.key !== "conflict" && statusLine.key !== "offline" && statusLine.key !== "error") return null;
    if (!sessionRidRef.current) sessionRidRef.current = makeRidClient();
    return {
      rid: sessionRidRef.current,
      pageId: selectedId ?? null,
      slug: page?.slug ?? undefined,
      saveStateKey: statusLine.key,
      isOnline: !isOffline,
      ts: new Date().toISOString(),
    };
  }, [statusLine.key, selectedId, page?.slug, isOffline]);

  // I4 – kopier support-snapshot til utklippstavle (feedback inline, ingen timer)
  const copySupportSnapshot = useCallback(async () => {
    if (!supportSnapshot) return;
    setSupportCopyFeedback(null);
    const str = JSON.stringify(supportSnapshot, null, 2);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(str);
        setSupportCopyFeedback("ok");
      } else {
        throw new Error("clipboard_unavailable");
      }
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = str;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        setSupportCopyFeedback(ok ? "ok" : "fail");
      } catch {
        setSupportCopyFeedback("fail");
      }
    }
  }, [supportSnapshot]);

  const applyParsedBody = useCallback((parsed: BodyParseResult) => {
    setBodyMode(parsed.mode);
    setBlocks(parsed.blocks);
    setMeta(parsed.meta ?? {});
    setLegacyBodyText(parsed.legacyText);
    setInvalidBodyRaw(parsed.rawBody);
    setBodyParseError(parsed.error);
    setExpandedBlockId(parsed.mode === "blocks" ? (parsed.blocks[0]?.id ?? null) : null);
  }, []);

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const updateSidebarItem = useCallback((next: ContentPage) => {
    setItems((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      let changed = false;
      const nextItems = prev.map((entry) => {
        if (entry.id !== next.id) return entry;

        changed = true;
        return {
          ...entry,
          title: safeStr(next.title),
          slug: safeStr(next.slug),
          status: next.status,
          updated_at: next.updated_at ?? entry.updated_at,
        };
      });

      return changed ? nextItems : prev;
    });
  }, []);

  const patchPage = useCallback(
    async (
      partial: Record<string, unknown>,
      fallbackMessage: string,
      options?: { syncEditor?: boolean; signal?: AbortSignal }
    ): Promise<ContentPage> => {
      if (!effectiveId) throw new Error("Mangler side-id.");

      const res = await fetch(
        `/api/backoffice/content/pages/${encodeURIComponent(effectiveId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(partial),
          signal: options?.signal,
        }
      );

      const payload = await parseJsonSafe<PageData>(res);

      if (!res.ok || !payload || payload.ok !== true) {
        const message = readApiError(res.status, payload, fallbackMessage);
        if (res.status === 409) {
          const e = new Error(message) as Error & { status: number };
          e.status = 409;
          throw e;
        }
        throw new Error(message);
      }

      const next = payload.data.page;

      if (options?.signal) {
        return next;
      }

      setPage((prev) => {
        if (!prev) return next;
        return { ...prev, ...next };
      });

      if (options?.syncEditor === true) {
        const nextTitle = safeStr(next.title);
        const nextSlug = safeStr(next.slug);
        const parsedBody = parseBodyToBlocks(next.body);
        const snapshotBody = deriveBodyFromParse(parsedBody);

        setTitle(nextTitle);
        setSlug(nextSlug);
        setSlugTouched(false);
        applyParsedBody(parsedBody);

        setSavedSnapshot(
          makeSnapshot({
            title: nextTitle,
            slug: nextSlug,
            body: snapshotBody,
          })
        );
      }

      updateSidebarItem(next);
      setLastSavedAt(next.updated_at ?? new Date().toISOString());
      setLastError(null);

      if (options?.syncEditor === true && next.id && next.id !== selectedId) {
        router.replace(`/backoffice/content/${next.id}`);
      }

      return next;
    },
    [effectiveId, selectedId, applyParsedBody, updateSidebarItem, router]
  );

  function isNetworkError(err: unknown): boolean {
    if (err instanceof TypeError && (err.message === "Failed to fetch" || err.message === "Load failed")) return true;
    return false;
  }

  const performSave = useCallback(async (): Promise<boolean> => {
    if (!selectedId || !page) return false;
    if (pageNotFound || detailError) return false;
    if (isOffline) {
      setSaveStateSafe("offline");
      setLastError(null);
      return false;
    }

    const nextTitle = safeStr(title);
    const nextSlug = normalizeSlug(slug);
    if (!nextTitle || !nextSlug) {
      setLastError("Tittel og slug er påkrevd.");
      setSaveStateSafe("error");
      return false;
    }

    if (saveState === "saving") {
      pendingSaveRef.current = true;
      return false;
    }

    clearAutosaveTimer();
    setSaveStateSafe("saving");
    setLastError(null);

    saveSeqRef.current += 1;
    const seq = saveSeqRef.current;
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortRef.current = controller;

    const body: Record<string, unknown> = {
      title: nextTitle,
      slug: nextSlug,
      body: bodyForSave,
      rid: makeRidClient(),
    };
    if (lastServerUpdatedAt) body.updated_at = lastServerUpdatedAt;

    try {
      const next = await patchPage(body, "Kunne ikke lagre side.", {
        syncEditor: true,
        signal: controller.signal,
      });
      if (seq !== saveSeqRef.current) return false;

      if (seq === saveSeqRef.current) {
        setPage((prev) => (prev ? { ...prev, ...next } : next));
        const nextTitleFromRes = safeStr(next.title);
        const nextSlugFromRes = safeStr(next.slug);
        const parsedBody = parseBodyToBlocks(next.body);
        const snapshotBody = deriveBodyFromParse(parsedBody);
        setTitle(nextTitleFromRes);
        setSlug(nextSlugFromRes);
        setSlugTouched(false);
        applyParsedBody(parsedBody);
        setSavedSnapshot(makeSnapshot({ title: nextTitleFromRes, slug: nextSlugFromRes, body: snapshotBody }));
        updateSidebarItem(next);
        setLastSavedAt(next.updated_at ?? new Date().toISOString());
        setLastError(null);
        setLastServerUpdatedAt(next.updated_at ?? null);
        setSaveStateSafe("saved");

        if (next.id && next.id !== selectedId) {
          router.replace(`/backoffice/content/${next.id}`);
        }

        const savedDraft: OutboxDraft = {
          title: nextTitle,
          slug: nextSlug,
          status: next.status,
          body: bodyForSave as string,
        };
        const savedFingerprint = djb2(JSON.stringify(savedDraft));
        const stored = readOutbox(effectiveId);
        if (stored && stored.fingerprint === savedFingerprint) {
          clearOutbox(effectiveId);
          setOutboxData(null);
        }
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          setTimeout(() => void performSaveRef.current(), 0);
        }
      }
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return false;
      }
      const message = err instanceof Error ? safeStr(err.message) : "Kunne ikke lagre side.";
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        if (seq !== saveSeqRef.current) return false;
        clearAutosaveTimer();
        setSaveStateSafe("conflict");
        setLastError(message);
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSaveStateSafe("offline");
        setLastError(message);
      } else if (isNetworkError(err)) {
        setSaveStateSafe("offline");
        setLastError(message);
      } else {
        setSaveStateSafe("error");
        setLastError(message);
      }
      return false;
    }
  }, [
    selectedId,
    page,
    pageNotFound,
    detailError,
    title,
    slug,
    bodyForSave,
    lastServerUpdatedAt,
    saveState,
    clearAutosaveTimer,
    patchPage,
    applyParsedBody,
    updateSidebarItem,
    router,
    effectiveId,
    isOffline,
  ]);

  const saveDraft = useCallback(async (source: "manual" | "autosave" | "shortcut" = "manual"): Promise<boolean> => {
    void source;
    return performSave();
  }, [performSave]);

  const currentServerFingerprint = useMemo(() => {
    if (!page) return null;
    const parsed = parseBodyToBlocks(page.body);
    const bodyStr = deriveBodyFromParse(parsed);
    const draft: OutboxDraft = { title: page.title, slug: page.slug, status: page.status, body: bodyStr };
    return djb2(JSON.stringify(draft));
  }, [page]);

  const hasFingerprintConflict = useMemo(
    () => Boolean(outboxData && currentServerFingerprint != null && outboxData.fingerprint !== currentServerFingerprint),
    [outboxData, currentServerFingerprint]
  );

  const onRestoreOutbox = useCallback(() => {
    if (hasFingerprintConflict) return;
    const entry = outboxData;
    if (!entry) return;
    setTitle(entry.draft.title);
    setSlug(entry.draft.slug);
    setSlugTouched(true);
    applyParsedBody(parseBodyToBlocks(entry.draft.body));
    setSaveStateSafe("dirty");
    setRecoveryBannerVisible(false);
  }, [hasFingerprintConflict, outboxData, applyParsedBody]);

  const onDiscardOutbox = useCallback(() => {
    if (outboxData) clearOutbox(outboxData.pageId);
    setOutboxData(null);
    setRecoveryBannerVisible(false);
    setOutboxDetailsExpanded(false);
  }, [outboxData]);

  // E1 – outbox copy/export (sanitert: ingen rå payload/body)
  const buildOutboxExportSnapshot = useCallback(
    (entry: OutboxEntry) => {
      if (!sessionRidRef.current) sessionRidRef.current = makeRidClient();
      // E1.3 – payloadBytes hardening
      const payloadBytes = safeJsonBytes(entry.draft);
      return {
        rid: sessionRidRef.current,
        pageId: entry.pageId,
        slug: entry.draft?.slug ?? undefined,
        outboxId: undefined as string | undefined,
        saveStateKey: "outbox" as const,
        isOnline: !isOffline,
        ts: new Date().toISOString(),
        itemTs: entry.savedAtLocal ?? null,
        attempts: null as number | null,
        lastError: null as string | null,
        payloadBytes,
      };
    },
    [isOffline]
  );

  const copyOutboxSafetyExport = useCallback(
    async (entry: OutboxEntry) => {
      // E1.3 – outbox feedback key hardening
      const key = getOutboxEntryKey(entry);
      setOutboxCopyFeedback((prev) => ({ ...prev, [key]: null }));
      const snapshot = buildOutboxExportSnapshot(entry);
      const str = JSON.stringify(snapshot, null, 2);
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(str);
          setOutboxCopyFeedback((prev) => ({ ...prev, [key]: "ok" }));
        } else {
          throw new Error("clipboard_unavailable");
        }
      } catch {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = str;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "fixed";
          textarea.style.left = "-9999px";
          document.body.appendChild(textarea);
          textarea.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(textarea);
          setOutboxCopyFeedback((prev) => ({ ...prev, [key]: ok ? "ok" : "fail" }));
        } catch {
          setOutboxCopyFeedback((prev) => ({ ...prev, [key]: "fail" }));
        }
      }
    },
    [buildOutboxExportSnapshot]
  );

  const onSave = useCallback(async () => {
    if (aiLastActionFeature && effectiveId) {
      logEditorAiEvent({
        type: "ai_save_after_action",
        pageId: effectiveId,
        variantId: null,
        feature: aiLastActionFeature,
        timestamp: new Date().toISOString(),
      });
      setAiLastActionFeature(null);
    }
    await saveDraft("manual");
  }, [saveDraft, aiLastActionFeature, effectiveId]);

  const onSaveAndPreview = async () => {
    if (canSave) await onSave();
    if (selectedId && typeof window !== "undefined") {
      window.open(
        `${window.location.origin}/backoffice/preview/${selectedId}`,
        "_blank",
        "noopener"
      );
    }
  };

  async function callAiSuggest(
    tool: Exclude<AiToolId, "block.builder">,
    input: Record<string, unknown>,
    options?: { metricsFeature?: EditorAiFeature }
  ): Promise<unknown> {
    const metricsFeature = options?.metricsFeature;
    setAiBusyToolId(tool);
    setAiError(null);
    setAiSummary(null);
    try {
      const body = {
        tool,
        pageId: effectiveId ?? null,
        variantId: null,
        environment: "preview",
        locale: "nb",
        input,
        blocks: buildAiBlocks(blocks),
        existingBlocks: buildAiExistingBlocks(blocks),
        meta: buildAiMeta(meta),
        pageTitle: title || undefined,
        pageSlug: slug || undefined,
      };
      const res = await fetch("/api/backoffice/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        const rawMsg =
          json &&
          typeof json === "object" &&
          "message" in (json as { message?: unknown }) &&
          typeof (json as { message?: unknown }).message === "string"
            ? (json as { message: string }).message
            : null;
        const code = json && typeof json === "object" && "error" in (json as { error?: unknown }) ? (json as { error: string }).error : null;
        const msg =
          res.status === 503 && (code === "FEATURE_DISABLED" || rawMsg === "AI is disabled.")
            ? "AI er ikke tilgjengelig (mangler serverkonfigurasjon)."
            : rawMsg || `Feil ${res.status}`;
        setAiError(msg);
        return null;
      }
      if (!json || typeof json !== "object" || !(json as { ok?: unknown }).ok) {
        const msg =
          (json as { message?: unknown })?.message &&
          typeof (json as { message?: unknown }).message === "string"
            ? ((json as { message: string }).message || "AI-forespørsel feilet.")
            : "AI-forespørsel feilet.";
        setAiError(msg);
        return null;
      }
      const rawData =
        "data" in (json as { data?: unknown })
          ? ((json as { data?: unknown }).data as unknown)
          : null;
      // API returns { ok, rid, data: { suggestionId?, suggestion? } }; payload for summary/patch is in data.suggestion
      const payload =
        rawData &&
        typeof rawData === "object" &&
        rawData !== null &&
        "suggestion" in (rawData as Record<string, unknown>)
          ? (rawData as { suggestion: unknown }).suggestion
          : rawData;
      const summary = extractAiSummary(tool, payload);
      if (summary) setAiSummary(summary);
      // Reset last applied marker unless this call produces a valid patch we can apply.
      setAiLastAppliedTool(null);

      if (metricsFeature) {
        const patchPresent = Boolean(
          payload &&
            typeof payload === "object" &&
            "patch" in (payload as Record<string, unknown>) &&
            isAIPatchV1((payload as { patch: unknown }).patch)
        );
        logEditorAiEvent({
          type: "ai_result_received",
          feature: metricsFeature,
          pageId: effectiveId ?? null,
          variantId: null,
          patchPresent,
          timestamp: new Date().toISOString(),
        });
      }

      // Apply patch to editor when suggestion returns a valid AIPatchV1 (Improve Page, SEO, Generate sections, etc.)
      if (
        payload &&
        typeof payload === "object" &&
        "patch" in (payload as Record<string, unknown>) &&
        isAIPatchV1((payload as { patch: unknown }).patch)
      ) {
        const patch = (payload as { patch: Parameters<typeof applyAIPatchV1>[1] }).patch;
        const body: BlockList = {
          version: 1,
          blocks: buildAiBlocks(blocks).map((b) => ({ id: b.id, type: b.type, data: b.data ?? {} })),
          meta: buildAiMeta(meta) ?? {},
        };
        const applied = applyAIPatchV1(body, patch);
        if (applied.ok) {
          const editorBlocks = applied.next.blocks.map((n) => ({
            id: n.id,
            type: n.type,
            ...(n.data ?? {}),
          }));
          applyParsedBody(
            parseBodyToBlocks({ blocks: editorBlocks, meta: applied.next.meta ?? {} })
          );
          setAiLastAppliedTool(tool);
          if (metricsFeature) {
            logEditorAiEvent({
              type: "ai_patch_applied",
              feature: metricsFeature,
              pageId: effectiveId ?? null,
              variantId: null,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
      return payload;
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Ukjent AI-feil.");
      return null;
    } finally {
      setAiBusyToolId(null);
    }
  }

  async function callDedicatedAiRoute<T = Record<string, unknown>>(params: {
    path: string;
    body: Record<string, unknown>;
    busyId: string;
    getSummary: (data: T) => string | null;
  }): Promise<T | null> {
    const { path, body, busyId, getSummary } = params;
    setAiBusyToolId(busyId);
    setAiError(null);
    setAiSummary(null);
    setAiBlockBuilderResult(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        const rawMsg =
          json &&
          typeof json === "object" &&
          "message" in (json as { message?: unknown }) &&
          typeof (json as { message?: unknown }).message === "string"
            ? (json as { message: string }).message
            : null;
        const code =
          json && typeof json === "object" && "error" in (json as { error?: unknown })
            ? (json as { error: string }).error
            : null;
        const msg =
          res.status === 503 && (code === "FEATURE_DISABLED" || rawMsg === "AI is disabled.")
            ? "AI er ikke tilgjengelig (mangler serverkonfigurasjon)."
            : rawMsg || `Feil ${res.status}`;
        setAiError(msg);
        return null;
      }
      const rawData =
        json && typeof json === "object" && "data" in (json as { data?: unknown })
          ? (json as { data: unknown }).data
          : null;
      const data = rawData as T | null;
      const summary = data ? getSummary(data) : null;
      if (summary) setAiSummary(summary);
      if (busyId === "block.builder" && data && typeof data === "object" && "block" in data) {
        const block = (data as { block?: unknown }).block;
        if (block && typeof block === "object" && !Array.isArray(block)) {
          setAiBlockBuilderResult({
            block: block as Record<string, unknown>,
            message: typeof (data as { message?: string }).message === "string"
              ? (data as { message: string }).message
              : "",
          });
        }
      }
      return data;
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Ukjent AI-feil.");
      return null;
    } finally {
      setAiBusyToolId(null);
    }
  }

  const handleAiImprovePage = useCallback(
    (input: { goal: "lead" | "info" | "signup"; audience: string }) => {
      const feature: EditorAiFeature = "improve_page";
      logEditorAiEvent({
        type: "ai_action_triggered",
        feature,
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      setAiLastActionFeature(feature);
      void callAiSuggest(
        "content.maintain.page",
        {
          goal: input.goal,
          audience: input.audience || undefined,
          brand: "Lunchportalen",
          mode: "safe",
        },
        { metricsFeature: feature }
      );
    },
    [blocks, meta, effectiveId, title, slug]
  );

  const handleAiSeoOptimize = useCallback(
    (
      input: { goal: "lead" | "info" | "signup"; audience: string },
      opts?: { fromInline?: boolean }
    ) => {
      const feature: EditorAiFeature = opts?.fromInline ? "seo_inline" : "seo_optimize";
      logEditorAiEvent({
        type: "ai_action_triggered",
        feature,
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      setAiLastActionFeature(feature);
      void callAiSuggest(
        "seo.optimize.page",
        {
          goal: input.goal,
          audience: input.audience || undefined,
          brand: "Lunchportalen",
          mode: "safe",
        },
        { metricsFeature: feature }
      );
    },
    [blocks, meta, effectiveId, title, slug]
  );

  const handleAiGenerateSections = useCallback(
    (input: { goal: string; audience: string }) => {
      const feature: EditorAiFeature = "generate_sections";
      logEditorAiEvent({
        type: "ai_action_triggered",
        feature,
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      setAiLastActionFeature(feature);
      void callAiSuggest(
        "landing.generate.sections",
        {
          goal: input.goal || undefined,
          audience: input.audience || undefined,
          offerName: title || undefined,
          tone: "enterprise",
        },
        { metricsFeature: feature }
      );
    },
    [blocks, meta, effectiveId, title, slug]
  );

  const handleAiStructuredIntent = useCallback(
    (
      input: { variantCount: 2 | 3; target: "hero_cta" | "hero_only" },
      opts?: { fromPanel?: boolean }
    ) => {
      const feature: EditorAiFeature =
        opts?.fromPanel !== false
          ? "structured_intent"
          : input.target === "hero_only"
            ? "hero_inline"
            : "cta_inline";
      logEditorAiEvent({
        type: "ai_action_triggered",
        feature,
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      setAiLastActionFeature(feature);
      void callAiSuggest(
        "experiment.generate.variants",
        {
          variantCount: input.variantCount,
          target: input.target,
          goal: "lead",
          brand: "Lunchportalen",
          mode: "safe",
        },
        { metricsFeature: feature }
      );
    },
    [blocks, meta, effectiveId, title, slug]
  );

  const handleAiImageGenerate = useCallback(
    (input: { purpose: "hero" | "section" | "social"; topic: string }) => {
      void callDedicatedAiRoute<{ message?: string; imageUrl?: string | null }>({
        path: "/api/backoffice/ai/image-generator",
        body: {
          topic: input.topic,
          purpose: input.purpose,
          locale: "nb",
          brand: "Lunchportalen",
        },
        busyId: "image.generate.brand_safe",
        getSummary: (d) => d.message ?? (d.imageUrl ? "Bildeforslag generert." : null),
      });
    },
    []
  );

  const handleAiImageImproveMetadata = useCallback(
    (input: { mediaItemId: string; url: string }) => {
      void callDedicatedAiRoute<{ message?: string; alt?: string }>({
        path: "/api/backoffice/ai/image-metadata",
        body: {
          mediaItemId: input.mediaItemId || undefined,
          url: input.url || undefined,
          locale: "nb",
          pageTitle: title || undefined,
        },
        busyId: "image.improve.metadata",
        getSummary: (d) => d.message ?? "Forslag til bilde-metadata er klare.",
      });
    },
    [title]
  );

  const handleLayoutSuggestions = useCallback(() => {
    void callDedicatedAiRoute<{ message?: string; suggestions?: unknown[] }>({
      path: "/api/backoffice/ai/layout-suggestions",
      body: {
        blocks: buildAiBlocks(blocks),
        title: title || undefined,
        slug: slug || undefined,
        pageId: effectiveId ?? undefined,
        locale: "nb",
      },
      busyId: "layout.suggestions",
      getSummary: (d) =>
        d.message ??
        (Array.isArray(d.suggestions) && d.suggestions.length > 0
          ? `${d.suggestions.length} layoutforslag.`
          : null),
    });
  }, [blocks, title, slug, effectiveId]);

  const handleBlockBuilder = useCallback(
    (input: { description: string }) => {
      void callDedicatedAiRoute<{ message?: string; block?: { type?: string } }>({
        path: "/api/backoffice/ai/block-builder",
        body: {
          description: input.description.trim(),
          locale: "nb",
          pageId: effectiveId ?? undefined,
        },
        busyId: "block.builder",
        getSummary: (d) =>
          d.message ?? (d.block?.type ? `Blokk generert: ${d.block.type}.` : null),
      });
    },
    [effectiveId]
  );

  const handleScreenshotBuilder = useCallback(
    (input: { screenshotUrl?: string; description?: string }) => {
      void callDedicatedAiRoute<{ message?: string; blocks?: unknown[] }>({
        path: "/api/backoffice/ai/screenshot-builder",
        body: {
          screenshotUrl: input.screenshotUrl?.trim() || undefined,
          description: input.description?.trim() || undefined,
          locale: "nb",
          pageId: effectiveId ?? undefined,
        },
        busyId: "screenshot.builder",
        getSummary: (d) =>
          d.message ??
          (Array.isArray(d.blocks) && d.blocks.length > 0
            ? `Skjermbilde-bootstrap: ${d.blocks.length} blokker.`
            : null),
      });
    },
    [effectiveId]
  );

  const onSetStatus = useCallback(
    async (nextStatus: PageStatus) => {
      if (!selectedId || !page || pageNotFound || detailError || savingRef.current || statusInProgressRef.current) return;

      statusInProgressRef.current = true;
      setIsStatusInProgress(true);
      setLastError(null);
      clearAutosaveTimer();

      statusSeqRef.current += 1;
      const seq = statusSeqRef.current;
      if (statusAbortRef.current) {
        statusAbortRef.current.abort();
      }
      const controller = new AbortController();
      statusAbortRef.current = controller;

      try {
        const next = await patchPage(
          { status: nextStatus },
          "Kunne ikke oppdatere status.",
          { syncEditor: false, signal: controller.signal }
        );
        if (seq !== statusSeqRef.current) {
          statusInProgressRef.current = false;
          setIsStatusInProgress(false);
          return;
        }

        const merged = page
          ? { ...page, status: next.status, updated_at: next.updated_at, published_at: next.published_at }
          : next;
        setPage(merged);
        updateSidebarItem(merged);
        setLastServerUpdatedAt(next.updated_at ?? null);
        setLastSavedAt(next.updated_at ?? new Date().toISOString());
        setLastError(null);
        setSaveStateSafe(dirty ? "dirty" : "idle");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          statusInProgressRef.current = false;
          setIsStatusInProgress(false);
          return;
        }
        const status = (err as { status?: number })?.status;
        const message = err instanceof Error ? safeStr(err.message) : "Kunne ikke oppdatere status.";
        if (status === 409) {
          if (seq !== statusSeqRef.current) return;
          clearAutosaveTimer();
          setSaveStateSafe("conflict");
          setLastError(message || "Kunne ikke oppdatere status.");
        } else {
          setLastError(message || "Kunne ikke oppdatere status.");
          setSaveStateSafe("error");
        }
      } finally {
        statusInProgressRef.current = false;
        setIsStatusInProgress(false);
      }
    },
    [selectedId, dirty, page, pageNotFound, detailError, clearAutosaveTimer, patchPage, updateSidebarItem]
  );

  const guardedPush = useCallback(
    (href: string): void => {
      if (dirty) {
        if (!window.confirm("Du har usikrede endringer. Vil du forlate siden?")) return;
      }
      clearAutosaveTimer();
      router.push(href);
    },
    [dirty, clearAutosaveTimer, router]
  );

  const onReloadFromServer = useCallback(() => {
    if (isOffline) return;
    clearAutosaveTimer();
    setRefetchDetailKey((k) => k + 1);
  }, [clearAutosaveTimer, isOffline]);

  const onSelectPage = useCallback(
    (nextId: string, _slugForUrl?: string) => {
      setMainView("page");
      const isSamePage = !nextId || nextId === page?.id || nextId === selectedId;
      if (isSamePage) return;
      guardedPush(`/backoffice/content/${nextId}`);
    },
    [selectedId, page?.id, guardedPush]
  );

  const setBlockById = useCallback((blockId: string, updater: (block: Block) => Block) => {
    setBlocks((prev) => prev.map((entry) => (entry.id === blockId ? updater(entry) : entry)));
  }, []);

  const onAddBlock = useCallback((type: AddModalBlockType) => {
    const next = createBlock(type as "hero" | "richText" | "image" | "cta" | "divider" | "banners" | "code");

    setBodyMode("blocks");
    setBodyParseError(null);
    setLegacyBodyText("");
    setInvalidBodyRaw("");

    setBlocks((prev) => [...prev, next]);
    setExpandedBlockId(next.id);
    setAddBlockModalOpen(false);
  }, []);

  const onMoveBlock = useCallback((blockId: string, direction: -1 | 1) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((entry) => entry.id === blockId);
      if (idx < 0) return prev;

      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;

      const next = [...prev];
      const current = next[idx];
      next[idx] = next[target];
      next[target] = current;
      return next;
    });
  }, []);

  const onDeleteBlock = useCallback((blockId: string) => {
    setBlocks((prev) => prev.filter((entry) => entry.id !== blockId));
    setExpandedBlockId((prev) => (prev === blockId ? null : prev));
  }, []);

  const onToggleBlock = useCallback((blockId: string) => {
    setExpandedBlockId((prev) => (prev === blockId ? null : blockId));
  }, []);

  const isForsidePage = useCallback(() => isForside(slug, title), [slug, title]);

  const onFillForsideFromRepo = useCallback(() => {
    const { blocks: forsideBlocks } = getForsideBody();
    const normalized = normalizeBlocks(forsideBlocks as unknown);
    setBodyMode("blocks");
    setBodyParseError(null);
    setLegacyBodyText("");
    setInvalidBodyRaw("");
    setBlocks(normalized);
    setExpandedBlockId(normalized[0]?.id ?? null);
  }, []);

  const onConvertLegacyBody = useCallback(() => {
    if (isForsidePage()) {
      onFillForsideFromRepo();
      return;
    }

    const next: RichTextBlock = {
      id: makeBlockId(),
      type: "richText",
      heading: "",
      body: legacyBodyText,
    };

    setBodyMode("blocks");
    setBodyParseError(null);
    setLegacyBodyText("");
    setInvalidBodyRaw("");
    setBlocks([next]);
    setExpandedBlockId(next.id);
  }, [legacyBodyText, isForsidePage, onFillForsideFromRepo]);

  const onResetInvalidBody = useCallback(() => {
    const proceed = window.confirm("Reset body til blokker? Dette kan ikke angres.");
    if (!proceed) return;

    setBodyMode("blocks");
    setBodyParseError(null);
    setLegacyBodyText("");
    setInvalidBodyRaw("");
    setBlocks([]);
    setExpandedBlockId(null);
  }, []);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    if (dirty && (saveState === "idle" || saveState === "saved")) setSaveStateSafe("dirty");
    if (!dirty && saveState === "dirty") setSaveStateSafe("idle");
  }, [dirty, saveState]);

  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  useEffect(() => {
    return () => {
      if (activeAbortRef.current) activeAbortRef.current.abort();
      if (statusAbortRef.current) statusAbortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (pageNotFound || detailError || !dirty || !effectiveId || !page) return;
    if (outboxWriteTimerRef.current) clearTimeout(outboxWriteTimerRef.current);
    outboxWriteTimerRef.current = setTimeout(() => {
      outboxWriteTimerRef.current = null;
      const draft: OutboxDraft = {
        title: safeStr(title),
        slug: normalizeSlug(slug),
        status: statusLabel,
        body: bodyForSave as string,
      };
      const fingerprint = djb2(JSON.stringify(draft));
      writeOutbox({
        pageId: effectiveId,
        savedAtLocal: new Date().toISOString(),
        updatedAtSeen: lastServerUpdatedAt,
        draft,
        fingerprint,
      });
    }, 250);
    return () => {
      if (outboxWriteTimerRef.current) {
        clearTimeout(outboxWriteTimerRef.current);
        outboxWriteTimerRef.current = null;
      }
    };
  }, [pageNotFound, detailError, dirty, effectiveId, page, title, slug, bodyForSave, statusLabel, lastServerUpdatedAt]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(safeStr(queryInput)), 180);
    return () => clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    if (!createSlugTouched) setCreateSlug(normalizeSlug(createTitle));
  }, [createTitle, createSlugTouched]);

  /** Umbraco Core Patch A: when Create panel opens, fetch parent page to get DocumentType.allowedChildren. */
  useEffect(() => {
    if (!createPanelOpen) {
      setAllowedChildTypes([]);
      setCreateDocumentTypeAlias(null);
      return;
    }
    const parentId = selectedId;
    if (!parentId) {
      setAllowedChildTypes(["page"]);
      setCreateParentLoading(false);
      return;
    }
    let cancelled = false;
    setCreateParentLoading(true);
    setAllowedChildTypes([]);
    fetch(`/api/backoffice/content/pages/${encodeURIComponent(parentId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        const pageData = data && typeof data === "object" && "data" in data ? (data as { data?: { page?: { body?: unknown } } }).data?.page : null;
        const body = pageData && typeof pageData === "object" && "body" in pageData ? (pageData as { body?: unknown }).body : undefined;
        const envelope = parseBodyEnvelope(body);
        const dt = envelope.documentType ? getDocType(envelope.documentType) : null;
        const allowed = (dt?.allowedChildren && dt.allowedChildren.length > 0) ? dt.allowedChildren : ["page"];
        setAllowedChildTypes(allowed);
      })
      .catch(() => {
        if (!cancelled) setAllowedChildTypes(["page"]);
      })
      .finally(() => {
        if (!cancelled) setCreateParentLoading(false);
      });
    return () => { cancelled = true; };
  }, [createPanelOpen, selectedId]);

  useEffect(() => {
    if (!slugTouched) setSlug(normalizeSlug(title));
  }, [title, slugTouched]);

  useEffect(() => {
    if (!headerVariant) {
      setHeaderEditConfig(null);
      setHeaderEditError(null);
      return;
    }
    let cancelled = false;
    setHeaderEditLoading(true);
    setHeaderEditError(null);
    fetch(`/api/backoffice/content/header-config/${encodeURIComponent(headerVariant)}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Fant ikke konfigurasjon" : `Feil ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled || !json?.ok || !json?.data) return;
        const d = json.data;
        setHeaderEditConfig({
          title: typeof d.title === "string" ? d.title : "",
          nav: Array.isArray(d.nav)
            ? d.nav.map((x: { label?: string; href?: string; exact?: boolean }) => ({
              label: typeof x?.label === "string" ? x.label : "",
              href: typeof x?.href === "string" ? x.href : "",
              exact: x?.exact === true,
            }))
            : [],
        });
      })
      .catch((err) => {
        if (!cancelled) setHeaderEditError(err instanceof Error ? err.message : "Kunne ikke laste");
      })
      .finally(() => {
        if (!cancelled) setHeaderEditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [headerVariant]);

  useEffect(() => {
    let active = true;

    async function syncAndLoadList() {
      // Vanlig listelast (seed-marketing-registry rute finnes ikke; utelatt for å unngå 404)
      setListLoading(true);
      setListError(null);

      const qs = query ? `?query=${encodeURIComponent(query)}` : "";

      try {
        const res = await fetch(`/api/backoffice/content/pages${qs}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await parseJsonSafe<ListData>(res);

        let loadedItems: ContentPageListItem[] =
          Array.isArray((payload as any)?.data?.items) ? (payload as any).data.items :
            Array.isArray((payload as any)?.items) ? (payload as any).items :
              Array.isArray((payload as any)?.pages) ? (payload as any).pages :
                [];

        if (!res.ok || !payload || (payload as any).ok !== true) {
          throw new Error(readApiError(res.status, payload, "Kunne ikke hente sider."));
        }

        const hasForside = loadedItems.some((item) => isForside(item.slug, item.title));
        if (!hasForside && loadedItems.length >= 0) {
          try {
            const createRes = await fetch("/api/backoffice/content/pages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: "Lunchportalen – firmalunsj med kontroll og forutsigbarhet",
                slug: "front",
              }),
            });
            const createPayload = await parseJsonSafe<{ ok?: boolean; item?: ContentPageListItem }>(createRes);
            const raw = createPayload as { ok?: boolean; item?: ContentPageListItem } | null;
            const created = raw?.ok === true ? raw.item : undefined;
            if (createRes.ok && created) {
              loadedItems = [created, ...loadedItems];
            }
          } catch {
            // Ignore: forside creation might fail (e.g. duplicate). List stays as-is.
          }
        }
        loadedItems = [...loadedItems].sort((a, b) => {
          const aFirst = isForside(a.slug, a.title);
          const bFirst = isForside(b.slug, b.title);
          if (aFirst && !bFirst) return -1;
          if (!aFirst && bFirst) return 1;
          return (a.title || "").localeCompare(b.title || "", "nb");
        });

        if (!active) return;

        setItems(loadedItems);
        setListError(null);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? safeStr(err.message) : "Kunne ikke hente sider.";
        setItems([]);
        setListError(message || "Kunne ikke hente sider.");
      } finally {
        if (active) setListLoading(false);
      }
    }

    void syncAndLoadList();
    return () => { active = false; };
  }, [query, listReloadKey]);

  useEffect(() => {
    if (!selectedId) {
      setPage(null);
      setTitle("");
      setSlug("");
      setSlugTouched(false);

      setBodyMode("blocks");
      setBlocks([]);
      setMeta({});
      setLegacyBodyText("");
      setInvalidBodyRaw("");
      setBodyParseError(null);
      setExpandedBlockId(null);

      setDetailError(null);
      setPageNotFound(false);
      setLastError(null);
      setLastSavedAt(null);
      setLastServerUpdatedAt(null);
      setSaveStateSafe("idle");
      setSavedSnapshot(null);
      setOutboxData(null);
      setRecoveryBannerVisible(false);
      return;
    }

    let active = true;

    async function loadPage() {
      setDetailLoading(true);
      setDetailError(null);
      setLastError(null);
      setLastSavedAt(null);

      try {
        const res = await fetch(
          `/api/backoffice/content/pages/${encodeURIComponent(selectedId)}`,
          { method: "GET", cache: "no-store" }
        );
        const payload = await parseJsonSafe<PageData>(res);

        if (res.status === 404) {
          if (!active) return;
          setPage(null);
          setSavedSnapshot(null);
          setOutboxData(null);
          setRecoveryBannerVisible(false);
          setDetailError(null);
          setPageNotFound(true);
          setDetailLoading(false);
          return;
        }

        if (!payload || payload.ok !== true) {
          throw new Error(readApiError(res.status, payload, "Kunne ikke hente side."));
        }

        if (!active) return;

        const data = (payload as ApiOk<PageData>).data;
        const next = data.page;
        if (next == null || next === undefined) {
          setPage(null);
          setSavedSnapshot(null);
          setOutboxData(null);
          setRecoveryBannerVisible(false);
          setDetailError(null);
          setPageNotFound(true);
          setDetailLoading(false);
          return;
        }

        setPageNotFound(false);
        const nextTitle = safeStr(next.title);
        const nextSlug = safeStr(next.slug);
        const envelope = parseBodyEnvelope(next.body);
        setDocumentTypeAlias(envelope.documentType);
        setEnvelopeFields(envelope.fields);
        const parsedBody = parseBodyToBlocks(envelope.blocksBody);
        const snapshotBody =
          envelope.documentType != null
            ? serializeBodyEnvelope({
              documentType: envelope.documentType,
              fields: envelope.fields,
              blocksBody: deriveBodyFromParse(parsedBody),
            })
            : deriveBodyFromParse(parsedBody);

        setPage(next);
        setTitle(nextTitle);
        setSlug(nextSlug);
        setSlugTouched(false);
        applyParsedBody(parsedBody);
        setLastServerUpdatedAt(next.updated_at ?? null);
        setSaveStateSafe("idle");
        setLastError(null);
        setSavedSnapshot(makeSnapshot({ title: nextTitle, slug: nextSlug, body: snapshotBody as string }));
        skipNextAutosaveScheduleRef.current = true;
        const outbox = readOutbox(next.id);
        if (outbox && looksMojibakeAny(outbox)) {
          clearOutbox(next.id);
          setOutboxData(null);
          setRecoveryBannerVisible(false);
        } else if (outbox) {
          const serverUpdated = next.updated_at ?? "";
          const localTs = Date.parse(outbox.savedAtLocal);
          const serverTs = Date.parse(serverUpdated);
          const bothValid = Number.isFinite(localTs) && Number.isFinite(serverTs);
          const localOlderOrEqual = !bothValid || localTs <= serverTs;
          if (localOlderOrEqual) {
            clearOutbox(next.id);
            setOutboxData(null);
            setRecoveryBannerVisible(false);
          } else {
            const serverDraft: OutboxDraft = {
              title: nextTitle,
              slug: nextSlug,
              status: next.status,
              body: snapshotBody as string,
            };
            const serverFp = djb2(JSON.stringify(serverDraft));
            if (outbox.fingerprint === serverFp) {
              clearOutbox(next.id);
              setOutboxData(null);
              setRecoveryBannerVisible(false);
            } else {
              // Lokal draft er nyere men innholdet avviker fra server → restore ville vært deaktivert.
              // Unngå mellomtilstand med permanent banner og deaktivert Gjenopprett: rydd ut og skjul.
              clearOutbox(next.id);
              setOutboxData(null);
              setRecoveryBannerVisible(false);
            }
          }
        } else {
          setOutboxData(null);
          setRecoveryBannerVisible(false);
        }
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? safeStr(err.message) : "Kunne ikke hente side.";
        setPage(null);
        setSavedSnapshot(null);
        setOutboxData(null);
        setRecoveryBannerVisible(false);
        setDetailError(message || "Kunne ikke hente side.");
        setPageNotFound(true);
      } finally {
        if (active) setDetailLoading(false);
      }
    }

    void loadPage();
    return () => { active = false; };
  }, [selectedId, applyParsedBody, refetchDetailKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (pageNotFound || !dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pageNotFound, dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = safeStr(event.key).toLowerCase();
      const saveCombo = (event.ctrlKey || event.metaKey) && key === "s";
      if (!saveCombo) return;
      if (!selectedId || !dirty || savingRef.current) return;

      event.preventDefault();
      void saveDraft("shortcut");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, dirty, saveDraft]);

  const draftKey = useMemo(() => `${title}\n${slug}\n${bodyForSave}`, [title, slug, bodyForSave]);

  useEffect(() => {
    clearAutosaveTimer();
    if (!dirty) return;
    if (pageNotFound || !selectedId || detailLoading || hasConflict || isOffline || !page || detailError) return;
    if (saveState !== "idle" && saveState !== "saved") return;
    if (skipNextAutosaveScheduleRef.current) {
      skipNextAutosaveScheduleRef.current = false;
      return;
    }

    autosaveTimerRef.current = setTimeout(() => {
      if (!dirtyRef.current || savingRef.current) return;
      void saveDraft("autosave");
    }, 800);

    return clearAutosaveTimer;
  }, [pageNotFound, selectedId, dirty, detailLoading, hasConflict, isOffline, page, detailError, draftKey, saveDraft, clearAutosaveTimer, saveState]);

  async function onCreate(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (creating) return;

    const nextTitle = safeStr(createTitle);
    const nextSlug = normalizeSlug(createSlug);

    if (!nextTitle || !nextSlug) {
      setCreateError("Title og slug er paakrevd.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const initialBody =
        createDocumentTypeAlias && createDocumentTypeAlias.trim() !== ""
          ? serializeBodyEnvelope({
            documentType: createDocumentTypeAlias,
            fields: {},
            blocksBody: "",
          })
          : undefined;
      const res = await fetch("/api/backoffice/content/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          initialBody != null ? { title: nextTitle, slug: nextSlug, body: initialBody } : { title: nextTitle, slug: nextSlug }
        ),
      });
      const payload = await parseJsonSafe<CreateData>(res);

      if (!res.ok || !payload || (payload as any).ok !== true) {
        throw new Error(readApiError(res.status, payload, "Kunne ikke opprette side."));
      }

      const created =
        (payload as any)?.data?.page ?? (payload as any)?.page ?? (payload as any)?.item;
      const nextId = safeStr(created?.id);
      if (!nextId) throw new Error("Mangler side-id fra API.");

      const createdSlug = safeStr(created?.slug);
      setCreateTitle("");
      setCreateSlug("");
      setCreateSlugTouched(false);
      setCreateDocumentTypeAlias(null);
      setListReloadKey((v) => v + 1);
      setCreatePanelOpen(false);
      setCreatePanelMode("choose");
      guardedPush(`/backoffice/content/${nextId}`);
    } catch (err) {
      const message = err instanceof Error ? safeStr(err.message) : "Kunne ikke opprette side.";
      setCreateError(message || "Kunne ikke opprette side.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div
        className={
          hideLegacySidebar
            ? "flex h-full min-h-0 min-w-0 flex-1 flex-col bg-slate-200/60"
            : "grid h-full grid-cols-1 bg-slate-200/60 md:grid-cols-[280px_minmax(0,1fr)]"
        }
      >
        {!hideLegacySidebar && (
          <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-100 md:border-b-0 md:border-r md:border-slate-200">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">Content</p>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="space-y-2 p-3">
                {/* Hjem – enkel klikk: merk/åpne siden; dobbel klikk: åpne/lukk dropdown */}
                {(() => {
                  const slugLabel = (s: string | null | undefined) => safeStr(s);
                  const isHomePage = (item: ContentPageListItem) => {
                    const sl = slugLabel(item.slug);
                    const t = (item.title || "").toLowerCase().trim();
                    return sl === "" || sl === "/" || sl === "index" || sl === "hjem" || sl === "front" || sl.toLowerCase() === "forside" || t === "forside" || (t.includes("lunchportalen") && t.includes("firmalunsj"));
                  };
                  const frontPage = items.find(isHomePage);
                  const selectedNorm = normalizeSlug(selectedId);
                  const isHjemActive = frontPage && (selectedId === frontPage.id || (selectedNorm && normalizeSlug(frontPage.slug) === selectedNorm) || (page?.slug && normalizeSlug(page.slug) === normalizeSlug(frontPage.slug)));
                  return (
                    <div className={`flex items-center gap-1 rounded-lg border ${isHjemActive ? "border-rose-200 bg-rose-50/90" : "border-slate-200/80 bg-white"}`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (hjemSingleClickTimerRef.current) return;
                          hjemSingleClickTimerRef.current = setTimeout(() => {
                            hjemSingleClickTimerRef.current = null;
                            if (frontPage) onSelectPage(frontPage.id, frontPage.slug);
                            // Enkel klikk: bare merk siden – dropdown forblir lukket
                          }, 250);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          if (hjemSingleClickTimerRef.current) {
                            clearTimeout(hjemSingleClickTimerRef.current);
                            hjemSingleClickTimerRef.current = null;
                          }
                          setHjemExpanded((prev) => !prev);
                        }}
                        className={`flex min-h-10 flex-1 items-center gap-2 rounded-l-lg px-2 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 ${isHjemActive ? "bg-transparent" : ""}`}
                        aria-current={isHjemActive ? "true" : undefined}
                        aria-expanded={hjemExpanded}
                        title="Enkel klikk: velg forsiden. Dobbel klikk: åpne/lukk sidetre."
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-600" aria-hidden>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                          </svg>
                        </span>
                        <span className="text-slate-500 shrink-0 text-sm" aria-hidden>{hjemExpanded ? "▼" : "▶"}</span>
                        <span className="flex-1 font-medium">Hjem</span>
                        <span className="shrink-0 text-slate-400" title="Forsiden er fast og kan ikke slettes" aria-hidden>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCreatePanelOpen(true); setCreatePanelMode("choose"); }}
                        className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-r-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Opprett innhold under Hjem"
                        title="Opprett innhold under Hjem"
                      >
                        <span className="text-lg leading-none">+</span>
                      </button>
                    </div>
                  );
                })()}

                {/* Global – under Hjem; klikk åpner Global i hovedvinduet */}
                <div className={`flex items-center gap-1 rounded-lg border ${mainView === "global" ? "border-rose-200 bg-rose-50/90" : "border-slate-200/80 bg-white"}`}>
                  <button
                    type="button"
                    onClick={() => setMainView("global")}
                    className="flex min-h-10 flex-1 items-center gap-2 rounded-l-lg px-2 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    aria-current={mainView === "global" ? "true" : undefined}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-600" aria-hidden>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    </span>
                    <span className="flex-1 font-medium">Global</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMainView("global")}
                    className="flex min-h-10 min-w-10 items-center justify-center rounded-r-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Å Global i hovedvinduet"
                    title="Å Global"
                  >
                    <span className="text-lg leading-none">+</span>
                  </button>
                </div>

                {/* Design – under Global (samme nivå) */}
                <div
                  className={`flex items-center gap-1 rounded-lg border ${mainView === "design" ? "border-rose-200 bg-rose-50/90" : "border-slate-200/80 bg-white"
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => setMainView("design")}
                    className="flex min-h-10 flex-1 items-center gap-2 rounded-l-lg px-2 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    title="Design"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-violet-600" aria-hidden>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M16 3h5v5" />
                        <path d="M8 3H3v5" />
                        <path d="M3 16v5h5" />
                        <path d="M21 16v5h-5" />
                        <path d="M4 4 9 9" />
                        <path d="m15 9 5-5" />
                        <path d="m4 20 5-5" />
                        <path d="m15 15 5 5" />
                      </svg>
                    </span>
                    <span className="flex-1 font-medium">Design</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMainView("design")}
                    className="flex min-h-10 min-w-10 items-center justify-center rounded-r-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Å Design"
                    title="Å Design"
                  >
                    <span className="text-lg leading-none">+</span>
                  </button>
                </div>

                {/* Recycle Bin – under Design (samme nivå) */}
                <div className="flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white">
                  <button
                    type="button"
                    className="flex min-h-10 flex-1 items-center gap-2 rounded-l-lg px-2 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    title="Papirkurv (kommer senere)"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-600" aria-hidden>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M19 6v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </span>
                    <span className="flex-1 font-medium">Recycle Bin</span>
                  </button>
                </div>

                {(!embedded && hjemExpanded) ? (
                  <div className="ml-1 border-l-2 border-slate-200 pl-3">
                    <label className="grid gap-1 text-xs">
                      <span className="text-slate-500">Search</span>
                      <input
                        value={queryInput}
                        onChange={(e) => setQueryInput(e.target.value)}
                        className="h-9 rounded-lg border border-slate-200 px-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                        placeholder="title / slug"
                      />
                    </label>
                    {listError ? (
                      <div className="mt-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
                        {listError}
                      </div>
                    ) : null}
                    <div className="mt-2 min-h-0">
                      {listLoading ? (
                        <div className="py-2 text-xs text-slate-500">Loading...</div>
                      ) : items.length === 0 ? (
                        <div className="py-2 text-xs text-slate-500">Ingen sider.</div>
                      ) : (
                        <ul className="space-y-0.5">
                          {items.map((item) => {
                            const itemSlugNorm = normalizeSlug(item.slug);
                            const selectedNorm = normalizeSlug(selectedId);
                            const active =
                              selectedId === item.id ||
                              (itemSlugNorm && selectedNorm && itemSlugNorm === selectedNorm) ||
                              (safeStr(page?.slug).length > 0 &&
                                normalizeSlug(page?.slug) === itemSlugNorm);
                            const slugLabel = safeStr(item.slug);
                            const itemTitle = (item.title || "").toLowerCase().trim();
                            const isHome =
                              slugLabel === "" || slugLabel === "/" || slugLabel === "index" || slugLabel === "hjem" ||
                              slugLabel.toLowerCase() === "forside" ||
                              slugLabel.toLowerCase() === "lunchportalen-firmalunsj-med-kontroll-og-forutsigbarhet" ||
                              itemTitle === "forside" ||
                              (itemTitle.includes("lunchportalen") && itemTitle.includes("firmalunsj"));
                            const displayTitle = isHome ? "Forside" : (item.title || "(Untitled)");
                            const displaySlug = isHome && !slugLabel ? "/" : `/${slugLabel || "-"}`;
                            return (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => onSelectPage(item.id, item.slug)}
                                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${active ? "bg-rose-50 text-slate-900" : "hover:bg-slate-50 text-slate-800"
                                    }`}
                                >
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-600">
                                    {isHome ? "⌂ " : "–"}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{displayTitle}</p>
                                    <p className="truncate text-[11px] text-slate-500">{displaySlug}</p>
                                  </div>
                                  <span
                                    className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${statusTone(
                                      item.status
                                    )}`}
                                  >
                                    {item.status === "published" ? "live" : "draft"}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : null}

                {[
                  { label: "Maler (dokumenttyper)", icon: "⊞" },
                ].map(({ label, icon }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500"
                  >
                    <span className="opacity-70">{icon}</span>
                    <span className="flex-1">{label}</span>
                    <span className="text-slate-400" title="Kommer snart">–</span>
                  </div>
                ))}

                <p className="mt-4 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  TJENESTER
                </p>
                {["Vercel", "Sanity", "Supabase"].map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600"
                  >
                    <span className="text-slate-400">–</span>
                    <span>{name}</span>
                    <span className="text-slate-400">–</span>
                  </div>
                ))}

                <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600">
                  <span>–</span>
                  <span>Papirkurv</span>
                  <span className="text-slate-400">–</span>
                </div>

                <p className="mt-4 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  INNSTILLINGER
                </p>
                <p className="px-2 text-[10px] text-slate-500">Struktur</p>
                {["Dokumenttyper", "Datatyper"].map((name) => (
                  <div key={name} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-600">
                    <span className="text-slate-400">–</span>
                    <span>{name}</span>
                  </div>
                ))}
                <p className="mt-2 px-2 text-[10px] text-slate-500">Avansert</p>
                <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-600">
                  <span className="text-slate-400">–</span>
                  <span>Logg</span>
                </div>
              </div>

              {/* Create-panel: åpnes ved tre prikker på Hjem */}
              {createPanelOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/20 md:z-30"
                    aria-hidden
                    onClick={() => { setCreatePanelOpen(false); setCreatePanelMode("choose"); setCreateDocumentTypeAlias(null); }}
                  />
                  <div
                    className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-xl md:z-40"
                    role="dialog"
                    aria-labelledby="create-panel-title"
                    aria-modal="true"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                      <h2 id="create-panel-title" className="text-sm font-semibold text-slate-800">
                        Opprett
                      </h2>
                      <button
                        type="button"
                        onClick={() => { setCreatePanelOpen(false); setCreatePanelMode("choose"); setCreateDocumentTypeAlias(null); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Lukk"
                      >
                        –
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      <p className="mb-4 text-sm text-slate-600">
                        {selectedId ? "Opprett undernode under valgt side." : "Opprett ny side."}
                      </p>
                      {createPanelMode === "choose" ? (
                        <>
                          {createParentLoading ? (
                            <p className="text-sm text-slate-500">Laster tillatte typer…</p>
                          ) : allowedChildTypes.length === 0 ? (
                            <p className="text-sm text-slate-500">Tilordne dokumenttype til forelder for å opprette undernoder, eller velg en forelder.</p>
                          ) : null}
                          {allowedChildTypes.map((alias) => {
                            const dt = getDocType(alias);
                            const name = dt?.name ?? alias;
                            return (
                              <button
                                key={alias}
                                type="button"
                                onClick={() => { setCreateDocumentTypeAlias(alias); setCreatePanelMode("form"); }}
                                className="mb-3 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-slate-200 bg-white p-6 text-left transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-2xl text-slate-600">
                                  ⊞
                                </span>
                                <span className="font-medium text-slate-800">{name}</span>
                                <span className="text-xs text-slate-500">
                                  Opprett en ny  ««{name} «».
                                </span>
                              </button>
                            );
                          })}
                          <div className="mt-6 flex justify-end">
                            <button
                              type="button"
                              onClick={() => { setCreatePanelOpen(false); setCreatePanelMode("choose"); setCreateDocumentTypeAlias(null); }}
                              className="text-sm text-slate-500 hover:text-slate-700"
                            >
                              Avbryt
                            </button>
                          </div>
                        </>
                      ) : (
                        <form onSubmit={onCreate} className="space-y-4">
                          <label className="grid gap-1 text-sm">
                            <span className="text-slate-600">Tittel</span>
                            <input
                              value={createTitle}
                              onChange={(e) => setCreateTitle(e.target.value)}
                              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                              placeholder="F.eks. Kontakt"
                            />
                          </label>
                          <label className="grid gap-1 text-sm">
                            <span className="text-slate-600">Slug</span>
                            <input
                              value={createSlug}
                              onChange={(e) => {
                                setCreateSlugTouched(true);
                                setCreateSlug(e.target.value);
                              }}
                              onBlur={() => setCreateSlug(normalizeSlug(createSlug))}
                              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                              placeholder="kontakt"
                            />
                          </label>
                          {createError ? (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                              {createError}
                            </div>
                          ) : null}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setCreatePanelMode("choose")}
                              className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Tilbake
                            </button>
                            <button
                              type="submit"
                              disabled={creating}
                              className="min-h-[40px] flex-1 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-60"
                            >
                              {creating
                                ? "Oppretter…"
                                : `Opprett ${createDocumentTypeAlias ? (getDocType(createDocumentTypeAlias)?.name ?? createDocumentTypeAlias) : "side"}`}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </aside>
        )}

        <section
          className={
            hideLegacySidebar
              ? "min-h-0 min-w-0 flex-1 overflow-y-auto bg-[rgb(var(--lp-card))]"
              : "min-h-0 min-w-0 overflow-y-auto bg-[rgb(var(--lp-card))]"
          }
        >
          <div className="w-full min-w-0 px-4 py-6 md:px-6">
            {mainView === "design" ? (
              <div className="space-y-6">
                <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Shop Design</h1>
                <div className="flex flex-wrap gap-1 border-b border-[rgb(var(--lp-border))] pb-2">
                  {(
                    [
                      "Layout",
                      "Logo",
                      "Colors",
                      "Spacing",
                      "Fonts",
                      "Backgrounds",
                      "CSS",
                      "JavaScript",
                      "Advanced",
                    ] as const
                  ).map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setDesignTab(label)}
                      className={`min-h-9 rounded-t-lg border px-4 text-sm font-medium ${designTab === label
                        ? "border-[rgb(var(--lp-border))] border-b-0 bg-white text-[rgb(var(--lp-text))] -mb-px"
                        : "border-transparent text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {designTab === "Layout" && (
                  <div className="space-y-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
                    {["Site Header", "Navigation", "Icons", "Headings", "Images", "Links", "Miscellaneous"].map(
                      (section) => (
                        <details
                          key={section}
                          className="group rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]"
                          open={section === "Site Header"}
                        >
                          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-[rgb(var(--lp-text))]">
                            <span>{section}</span>
                            <span className="text-[rgb(var(--lp-muted))] group-open:rotate-180">–</span>
                          </summary>
                        </details>
                      )
                    )}
                  </div>
                )}

                {designTab === "Logo" && (
                  <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div>
                        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Website logo</h2>
                      </div>
                      <div className="row-span-2 flex items-center justify-center">
                        <div className="flex h-32 w-64 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                          <span className="text-xs text-[rgb(var(--lp-muted))]">Logo</span>
                        </div>
                      </div>
                    </section>

                    <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div>
                        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Favicon</h2>
                        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                          En favicon er et lite ikon som brukes som branding for nettstedet. Vises i nettleserfaner og
                          blant favoritter.
                        </p>
                      </div>
                      <div className="row-span-2 flex items-center justify-center">
                        <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                          <span className="text-xs text-[rgb(var(--lp-muted))]">Favicon</span>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {designTab === "Colors" && (
                  <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    <div className="min-w-0 space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                      <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
                          Color palette
                        </h2>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Lag en fargepalett som brukes i designet. Valgene vises i fargevelgeren for enkel gjenbruk.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {[
                            "#000000",
                            "#f2e8ce",
                            "#644b36",
                            "#fb6f01",
                            "#f4b905",
                            "#000000",
                            "#22c55e",
                            "#ec4899",
                            "#3b82f6",
                            "#8b5cf6",
                            "#f4b905",
                            "#fb6f01",
                            "#06b6d4",
                            "#ec4899",
                            "#22c55e",
                            "#7c2d12",
                            "#c2410c",
                          ].map((hex, idx) => (
                            <label key={idx} className="flex cursor-pointer items-center gap-0.5 rounded border border-[rgb(var(--lp-border))] p-0.5">
                              <input type="color" defaultValue={hex} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                              <span className="text-[10px] text-[rgb(var(--lp-muted))]">–</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-sm">+</button>
                          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-sm">+</button>
                        </div>
                      </section>

                      <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
                          Baseline colors
                        </h2>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Bygg opp basisfargepaletten for temaet ditt.
                        </p>

                        {[
                          { id: "body", label: "Body", solidGradient: true, fields: [{ key: "background", label: "Background", hex: "#f2e8ce" }] },
                          {
                            id: "header",
                            label: "Header",
                            solidGradient: true,
                            fields: [
                              { key: "background", label: "Background", hex: "#f2e8ce" },
                              { key: "text", label: "Text", hex: "#644b36" },
                              { key: "highlight", label: "Highlight", hex: "#fb6f01" },
                              { key: "borders", label: "Borders", hex: "#d7d7d7" },
                            ],
                          },
                          { id: "logo", label: "Logo", solidGradient: false, fields: [{ key: "color", label: "Logo", hex: "#644b36" }] },
                          {
                            id: "link",
                            label: "Link",
                            solidGradient: false,
                            fields: [
                              { key: "link", label: "Link", hex: "#644b36" },
                              { key: "linkHover", label: "Link hover", hex: "#000000" },
                            ],
                          },
                          {
                            id: "mainnav",
                            label: "Main navigation",
                            solidGradient: false,
                            fields: [
                              { key: "link", label: "Link", hex: "#5d4a3a" },
                              { key: "linkActive", label: "Link active", hex: "#000000" },
                              { key: "linkHover", label: "Link hover", hex: "#000000" },
                            ],
                          },
                          {
                            id: "secondarynav",
                            label: "Secondary navigation",
                            solidGradient: false,
                            fields: [
                              { key: "link", label: "Link", hex: "#5d4a3a" },
                              { key: "linkHover", label: "Link hover", hex: "#5d4a3a" },
                            ],
                          },
                          {
                            id: "navdropdowns",
                            label: "Navigation dropdowns",
                            solidGradient: true,
                            fields: [
                              { key: "background", label: "Background", hex: "#f8f8f8" },
                              { key: "link", label: "Link", hex: "#5d4a3a" },
                              { key: "linkHover", label: "Link hover", hex: "#4f4f4f" },
                              { key: "linkActive", label: "Link active", hex: "#000000" },
                            ],
                          },
                          {
                            id: "content",
                            label: "Content",
                            solidGradient: true,
                            fields: [
                              { key: "background", label: "Background", hex: colorsContentBg },
                              { key: "heading", label: "Heading", hex: "#000000" },
                              { key: "secondaryHeading", label: "Secondary Heading", hex: "#000000" },
                              { key: "text", label: "Text", hex: "#000000" },
                              { key: "link", label: "Link", hex: "#000000" },
                              { key: "linkHover", label: "Link hover", hex: "#000000" },
                              { key: "border", label: "Border", hex: "#000000" },
                              { key: "highlightBg", label: "Highlight background", hex: "#000000" },
                              { key: "highlightText", label: "Highlight text", hex: "#e5e5e5" },
                            ],
                          },
                          {
                            id: "button",
                            label: "Button",
                            solidGradient: true,
                            fields: [
                              { key: "background", label: "Background", hex: colorsButtonBg },
                              { key: "text", label: "Text", hex: colorsButtonText },
                              { key: "border", label: "Border", hex: colorsButtonBorder },
                            ],
                            hover: [
                              { key: "backgroundHover", label: "Background hover", hex: "#6e5338" },
                              { key: "textHover", label: "Text hover", hex: "#ffffff" },
                              { key: "borderHover", label: "Border hover", hex: "#6e5338" },
                            ],
                          },
                          {
                            id: "footer",
                            label: "Footer",
                            solidGradient: true,
                            fields: [
                              { key: "background", label: "Background", hex: "#f8e7a0" },
                              { key: "heading", label: "Heading", hex: "#644b36" },
                              { key: "text", label: "Text", hex: "#6e5338" },
                              { key: "linkHover", label: "Link hover", hex: "#4f4f4f" },
                              { key: "highlight", label: "Highlight", hex: "#000000" },
                              { key: "secondaryHeading", label: "Secondary heading", hex: "#000000" },
                              { key: "link", label: "Link", hex: "#000000" },
                              { key: "borders", label: "Borders", hex: "#d7d7d7" },
                            ],
                          },
                        ].map((section) => (
                          <details key={section.id} className="group rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] [&::-webkit-details-marker]:hidden">
                              <span
                                className="h-6 w-6 shrink-0 rounded border border-[rgb(var(--lp-border))]"
                                style={{ backgroundColor: section.fields[0]?.hex ?? "#f2e8ce" }}
                                aria-hidden
                              />
                              <span className="flex-1">{section.label}</span>
                              <span className="text-[rgb(var(--lp-muted))] transition group-open:rotate-180">–</span>
                            </summary>
                            <div className="border-t border-[rgb(var(--lp-border))] px-3 pb-3 pt-2">
                              {section.solidGradient && (
                                <div className="mb-2 flex gap-1">
                                  <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                                  <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                                </div>
                              )}
                              <div className="space-y-2">
                                {section.fields.map((field) => (
                                  <div key={field.key} className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-[rgb(var(--lp-text))]">{field.label}</span>
                                    <label className="flex cursor-pointer items-center gap-1">
                                      <input
                                        type="color"
                                        defaultValue={field.hex}
                                        onChange={(e) => {
                                          if (section.id === "content" && field.key === "background") setColorsContentBg(e.target.value);
                                          if (section.id === "button" && field.key === "background") setColorsButtonBg(e.target.value);
                                          if (section.id === "button" && field.key === "text") setColorsButtonText(e.target.value);
                                          if (section.id === "button" && field.key === "border") setColorsButtonBorder(e.target.value);
                                        }}
                                        className="h-6 w-6 cursor-pointer rounded border-0 border-transparent bg-transparent p-0"
                                      />
                                      <span className="text-[rgb(var(--lp-muted))]">–</span>
                                    </label>
                                  </div>
                                ))}
                              </div>
                              {"hover" in section && Array.isArray(section.hover) && (
                                <>
                                  <p className="mt-3 mb-1 text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Hover</p>
                                  <div className="mb-2 flex gap-1">
                                    <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                                    <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                                  </div>
                                  <div className="space-y-2">
                                    {section.hover.map((field: { key: string; label: string; hex: string }) => (
                                      <div key={field.key} className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-[rgb(var(--lp-text))]">{field.label}</span>
                                        <label className="flex cursor-pointer items-center gap-1">
                                          <input type="color" defaultValue={field.hex} className="h-6 w-6 cursor-pointer rounded border-0 border-transparent bg-transparent p-0" />
                                          <span className="text-[rgb(var(--lp-muted))]">–</span>
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </details>
                        ))}
                      </section>

                      <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
                          Additional content colors
                        </h2>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Bygg opp full fargepalett med bakgrunn, overskrifter, tekst og lenkekombinasjoner. Legg til så mange du vil.
                        </p>
                        <details className="group rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                          <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                            <span className="h-6 w-6 shrink-0 rounded bg-amber-300" aria-hidden />
                            <span className="flex-1 font-medium text-[rgb(var(--lp-text))]">c1</span>
                            <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-xs" aria-label="Dupliser">+</button>
                            <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-xs text-white" aria-label="Slett">–</button>
                            <span className="text-[rgb(var(--lp-muted))] group-open:rotate-180">–</span>
                          </summary>
                          <div className="border-t border-[rgb(var(--lp-border))] px-3 pb-3 pt-2">
                            <div className="mb-2 flex gap-1">
                              <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                              <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                            </div>
                            {["Background", "Heading", "Secondary Heading", "Text", "Link", "Link hover", "Border", "Highlight background", "Highlight text"].map((label) => (
                              <div key={label} className="flex items-center justify-between gap-2 py-1">
                                <span className="text-xs text-[rgb(var(--lp-text))]">{label}</span>
                                <label className="flex cursor-pointer items-center gap-1">
                                  <input type="color" defaultValue="#f5d385" className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                                  <span className="text-[rgb(var(--lp-muted))]">–</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </details>
                        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-lg text-[rgb(var(--lp-muted))] hover:border-slate-300">+</button>
                      </section>

                      <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
                          Additional button colors
                        </h2>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Bygg knappefargekombinasjoner for call-to-actions. Legg til så mange du vil.
                        </p>
                        <details className="group rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                          <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                            <span className="h-6 w-6 shrink-0 rounded bg-amber-400" aria-hidden />
                            <span className="flex-1 font-medium text-[rgb(var(--lp-text))]">c1-btn</span>
                            <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-xs" aria-label="Dupliser">+</button>
                            <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-xs text-white" aria-label="Slett">–</button>
                            <span className="text-[rgb(var(--lp-muted))] group-open:rotate-180">–</span>
                          </summary>
                          <div className="border-t border-[rgb(var(--lp-border))] px-3 pb-3 pt-2">
                            <p className="mb-1 text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Default</p>
                            <div className="mb-2 flex gap-1">
                              <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                              <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                            </div>
                            {["Background", "Text", "Border"].map((label) => (
                              <div key={label} className="flex items-center justify-between gap-2 py-1">
                                <span className="text-xs text-[rgb(var(--lp-text))]">{label}</span>
                                <label className="flex cursor-pointer items-center gap-1">
                                  <input type="color" defaultValue={label === "Background" ? "#f8e7a0" : label === "Text" ? "#000000" : "#6e5338"} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                                  <span className="text-[rgb(var(--lp-muted))]">–</span>
                                </label>
                              </div>
                            ))}
                            <p className="mt-3 mb-1 text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Hover</p>
                            <div className="mb-2 flex gap-1">
                              <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                              <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                            </div>
                            {["Background hover", "Text hover", "Border hover"].map((label) => (
                              <div key={label} className="flex items-center justify-between gap-2 py-1">
                                <span className="text-xs text-[rgb(var(--lp-text))]">{label}</span>
                                <label className="flex cursor-pointer items-center gap-1">
                                  <input type="color" defaultValue={label.includes("Background") ? "#6e5338" : label.includes("Text") ? "#ffffff" : "#6e5338"} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                                  <span className="text-[rgb(var(--lp-muted))]">–</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </details>
                        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-lg text-[rgb(var(--lp-muted))] hover:border-slate-300">+</button>
                      </section>

                      <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
                          Label colors
                        </h2>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Lag fargekombinasjoner for etiketter som brukes til å fremheve tekst.
                        </p>
                        {labelColors.map((colors, i) => (
                          <details key={i} className="group rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                              <span
                                className="h-6 w-6 shrink-0 rounded border border-[rgb(var(--lp-border))]"
                                style={{ backgroundColor: colors.background }}
                                aria-hidden
                              />
                              <span className="flex-1 font-medium text-[rgb(var(--lp-text))]">Label {i + 1}</span>
                              <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-xs" aria-label="Dupliser">+</button>
                              <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-xs text-white" aria-label="Slett">–</button>
                              <span className="text-[rgb(var(--lp-muted))] transition group-open:rotate-180">–</span>
                            </summary>
                            <div className="border-t border-[rgb(var(--lp-border))] px-3 pb-3 pt-3">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="h-10 w-10 shrink-0 rounded border border-[rgb(var(--lp-border))]"
                                      style={{ backgroundColor: colors.background }}
                                      aria-hidden
                                    />
                                    <div className="flex gap-1">
                                      <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                                      <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-[rgb(var(--lp-text))]">Background</span>
                                      <label className="flex cursor-pointer items-center gap-1">
                                        <input
                                          type="color"
                                          value={colors.background}
                                          onChange={(e) => {
                                            const next = [...labelColors];
                                            next[i] = { ...next[i]!, background: e.target.value };
                                            setLabelColors(next);
                                          }}
                                          className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                                        />
                                        <span className="text-[rgb(var(--lp-muted))]">–</span>
                                      </label>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-[rgb(var(--lp-text))]">Text</span>
                                      <label className="flex cursor-pointer items-center gap-1">
                                        <input
                                          type="color"
                                          value={colors.text}
                                          onChange={(e) => {
                                            const next = [...labelColors];
                                            next[i] = { ...next[i]!, text: e.target.value };
                                            setLabelColors(next);
                                          }}
                                          className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                                        />
                                        <span className="text-[rgb(var(--lp-muted))]">–</span>
                                      </label>
                                    </div>
                                  </div>
                                </div>
                                <div
                                  className="flex min-h-[80px] flex-1 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] px-4 py-3 sm:min-w-[200px]"
                                  style={{ backgroundColor: "#fef3c7" }}
                                >
                                  <span
                                    className="rounded px-3 py-1.5 text-sm font-medium"
                                    style={{ backgroundColor: colors.background, color: colors.text }}
                                  >
                                    I am a label!
                                  </span>
                                </div>
                              </div>
                            </div>
                          </details>
                        ))}
                        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-lg text-[rgb(var(--lp-muted))] hover:border-slate-300">+</button>
                      </section>
                    </div>

                    <div className="hidden lg:block">
                      <div
                        className="sticky top-6 rounded-xl border border-[rgb(var(--lp-border))] p-6"
                        style={{ backgroundColor: colorsContentBg, minHeight: 320 }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-text))]/70">Preview on desktop</p>
                        <p className="mt-2 text-lg font-bold text-[rgb(var(--lp-text))]">SECONDARY HEADING</p>
                        <h2 className="mt-1 text-2xl font-bold text-[rgb(var(--lp-text))]">Headings here</h2>
                        <p className="mt-3 text-sm leading-relaxed text-[rgb(var(--lp-text))]">
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.{" "}
                          <span className="underline">feugiat risus</span> quis nostrud exercitation.{" "}
                          <span className="rounded bg-black px-1 py-0.5 text-white">Vivamus consequat</span> ullamco laboris nisi ut aliquip ex ea commodo consequat.
                        </p>
                        <p className="mt-2 text-4xl font-serif text-[rgb(var(--lp-text))]">&quot;</p>
                        <p className="mt-2 text-sm text-[rgb(var(--lp-text))]">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                        <div className="mt-4 flex gap-3">
                          <button
                            type="button"
                            className="rounded-lg border-2 px-4 py-2 text-sm font-medium"
                            style={{ backgroundColor: colorsButtonBg, color: colorsButtonText, borderColor: colorsButtonBorder }}
                          >
                            Lorem ipsum dolor
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border-2 px-4 py-2 text-sm font-medium"
                            style={{ backgroundColor: colorsButtonBg, color: colorsButtonText, borderColor: colorsButtonBorder }}
                          >
                            Vivamus consequat
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {designTab === "Fonts" && (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <section className="space-y-3">
                      <div>
                        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Fonts</h2>
                        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                          Velg skrifter som brukes i designet. Du kan kombinere systemfonter, Google Fonts og Adobe
                          Fonts.
                        </p>
                      </div>
                      <div className="space-y-2">
                        {[
                          "Funnel Sans, sans-serif, normal, 300",
                          'font-family: "roca", sans-serif, font-style: normal; font-weight: 400;',
                          "futura-pt, sans-serif, normal, 400;",
                          "roca, sans-serif, normal, 800;",
                        ].map((fontLabel) => (
                          <div
                            key={fontLabel}
                            className="flex items-center gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 text-sm"
                          >
                            <span className="flex-1 truncate text-[rgb(var(--lp-text))]">{fontLabel}</span>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-xs"
                              aria-label="Dupliser"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-xs text-white"
                              aria-label="Slett"
                            >
                              –
                            </button>
                            <span className="text-[rgb(var(--lp-muted))]">–</span>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="flex h-9 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                        >
                          +
                        </button>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Typography</h2>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">
                        Knytt skrifttypene over til ulike typografi–roller i designet.
                      </p>
                      <div className="space-y-2">
                        {[
                          "Body",
                          "H1",
                          "H2",
                          "H3",
                          "H4",
                          "H5",
                          "H6",
                          "Heading (small)",
                          "Heading (medium)",
                          "Heading (large)",
                          "Secondary heading (small)",
                          "Secondary heading (medium)",
                          "Secondary heading (large)",
                          "Introduction (small)",
                          "Introduction (medium)",
                          "Introduction (large)",
                          "Blockquote (small)",
                          "Blockquote (medium)",
                          "Blockquote (large)",
                          "Button (small)",
                          "Button (medium)",
                          "Button (large)",
                          "Main navigation",
                          "Secondary navigation",
                          "Navigation dropdowns",
                          "Sub navigation",
                          "Footer navigation",
                          "Breadcrumb navigation",
                          "Anchor navigation",
                          "Accordion & tab navigation",
                          "Logo",
                        ].map((label) => (
                          <button
                            key={label}
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 text-left text-sm hover:bg-white"
                          >
                            <span className="font-medium text-[rgb(var(--lp-text))]">{label}</span>
                            <span className="text-[rgb(var(--lp-muted))]">–</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {designTab === "Backgrounds" && (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    {["Body", "Header", "Footer"].map((section) => (
                      <section key={section} className="space-y-3">
                        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">
                          {section} background image
                        </h2>
                        <div className="flex flex-col gap-4 md:flex-row">
                          <div className="flex items-center justify-center">
                            <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                              <span className="text-xs text-[rgb(var(--lp-muted))]">+</span>
                            </div>
                          </div>
                          <div className="flex-1 space-y-4">
                            <div className="space-y-1">
                              <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                                {section} background image opacity
                              </p>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-[rgb(var(--lp-muted))]">0</span>
                                <div className="relative h-1 flex-1 rounded-full bg-[rgb(var(--lp-border))]">
                                  <div className="absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--lp-text))]" />
                                </div>
                                <span className="flex items-center gap-1 text-[11px] text-[rgb(var(--lp-muted))]">
                                  <span>100</span>
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                                {section} background image options
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                                {["COVER", "FULL-WIDTH", "AUTO", "REPEAT", "REPEAT HORIZONTAL", "REPEAT VERTICAL"].map(
                                  (label) => (
                                    <button
                                      key={label}
                                      type="button"
                                      className="min-h-[32px] rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-[11px] font-medium text-[rgb(var(--lp-muted))]"
                                    >
                                      {label}
                                    </button>
                                  )
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs md:grid-cols-5">
                                {["–", "+", "–", "–", "–", "–", "–", "–", "+"].map((icon, idx) => (
                                  <button
                                    key={`${section}-pos-${idx}`}
                                    type="button"
                                    className="flex min-h-[32px] items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white text-[11px] text-[rgb(var(--lp-muted))]"
                                  >
                                    {icon}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                )}

                {designTab === "CSS" && (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <section className="space-y-2">
                      <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Custom CSS</h2>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">
                        Legg til tilpasset CSS som kun brukes av dette designet.
                      </p>
                      <textarea
                        rows={14}
                        className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
                      />
                    </section>

                    <section className="space-y-4">
                      <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">
                          Additional content color CSS
                        </h2>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Brukes til å generere ekstra CSS for innholdsfarger definert under Colors.
                        </p>
                        <textarea
                          rows={4}
                          className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
                        />
                      </div>

                      <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">
                          Additional button color CSS
                        </h2>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Brukes til å style ekstra knappfarger (for eksempel CTA–knapper) fra Colors–fanen.
                        </p>
                        <textarea
                          rows={8}
                          className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
                        />
                      </div>

                      <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Additional print only CSS</h2>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Brukes til å definere egne stiler som bare gjelder for utskrift.
                        </p>
                        <textarea
                          rows={4}
                          className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
                        />
                      </div>
                    </section>
                  </div>
                )}

                {designTab === "JavaScript" && (
                  <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Custom JS</h2>
                    <p className="text-xs text-[rgb(var(--lp-muted))]">
                      Legg til JavaScript som kun brukes av dette designet. Ikke inkluder <code>&lt;script&gt;</code>
                      –tagger; disse legges til automatisk.
                    </p>
                    <textarea
                      rows={18}
                      className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
                    />
                  </div>
                )}

                {designTab === "Advanced" && (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <section className="space-y-3">
                      <div className="rounded-lg bg-[rgb(var(--lp-card))] px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">
                        <p className="mb-1 text-sm font-semibold text-[rgb(var(--lp-text))]">Frontend source</p>
                        <p>
                           ««Frontend source «» er mappen med kildekode for designet. Standardverdi er{" "}
                          <span className="font-mono">uSkinned</span>. Hvis du endrer kildekode bør du opprette egne
                          mappeøpostmaler og partials, og registrere disse i{" "}
                          <span className="font-mono">appsettings.json</span>.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium text-[rgb(var(--lp-text))]">Frontend source*</span>
                          <select className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-sm">
                            <option>uSkinned</option>
                          </select>
                        </label>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Disable delete</h2>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">
                        Hvis  ««Yes «» er valgt, vil forsøk på å slette denne noden blokkeres og en advarsel vises.
                      </p>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        YES
                      </button>
                    </section>
                  </div>
                )}

                {designTab !== "Layout" &&
                  designTab !== "Logo" &&
                  designTab !== "Colors" &&
                  designTab !== "Fonts" &&
                  designTab !== "Backgrounds" &&
                  designTab !== "CSS" &&
                  designTab !== "JavaScript" &&
                  designTab !== "Advanced" && (
                    <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                      <p className="text-sm text-[rgb(var(--lp-muted))]">
                        {designTab}–fanen. Kommer senere i design–systemet.
                      </p>
                    </div>
                  )}

                <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
                  <p className="text-xs text-[rgb(var(--lp-muted))]">Design / Shop Design</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-green-700 hover:bg-slate-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="min-h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Save and publish
                    </button>
                  </div>
                </div>
              </div>
            ) : mainView === "global" && globalSubView === "content-and-settings" ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setGlobalSubView(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                    aria-label="Tilbake til Global"
                  >
                    –
                  </button>
                  <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Innhold og innstillinger</h1>
                </div>
                <div className="flex flex-wrap gap-1 border-b border-[rgb(var(--lp-border))] pb-2">
                  {(
                    [
                      ["general", "Generell"],
                      ["analytics", "Analytics"],
                      ["form", "Skjema"],
                      ["shop", "Butikk"],
                      ["globalContent", "Globalt innhold"],
                      ["notification", "Varsling"],
                      ["scripts", "Scripts"],
                      ["advanced", "Avansert"],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setContentSettingsTab(tab)}
                      className={`min-h-9 rounded-t-lg border px-3 text-sm font-medium ${contentSettingsTab === tab
                        ? "border-[rgb(var(--lp-border))] border-b-0 bg-white text-[rgb(var(--lp-text))] -mb-px"
                        : "border-transparent text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {contentSettingsTab === "general" && (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
                      Denne seksjonen styrer globale innstillinger som gjelder hele nettstedet.
                    </div>
                    <div className="grid gap-4">
                      <label className="grid gap-1">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Designstil *</span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">Velg designstil for nettstedet.</span>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="text"
                            defaultValue="Standard"
                            className="h-10 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                            readOnly
                          />
                          <button type="button" className="text-sm text-[rgb(var(--lp-muted))] hover:underline">
                            Å
                          </button>
                          <button type="button" className="text-sm text-[rgb(var(--lp-muted))] hover:underline">
                            Fjern
                          </button>
                        </div>
                      </label>

                      <label className="grid gap-1">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Nettstedsnavn *</span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">
                          Vises i standard Meta-tittel og som logo-tekst (skjules hvis logo er lagt til).
                        </span>
                        <input
                          type="text"
                          placeholder="F.eks. Lunchportalen"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                        />
                      </label>

                      <label className="grid gap-1">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Standard delingsbilde</span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">
                          Bilde som brukes når noen deler en side på sosiale medier (f.eks. X eller Facebook).
                        </span>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                            Bilde
                          </div>
                          <p className="text-xs text-[rgb(var(--lp-muted))]">Anbefaler minst 1200×630 px.</p>
                        </div>
                      </label>

                      <label className="grid gap-1">
                        <span className="font-medium text-[rgb(var(--lp-text))]">
                          X (Twitter) nettstedsbrukernavn
                        </span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">
                          Brukernavn som vises i X (Twitter)-kortets footer.
                        </span>
                        <input
                          type="text"
                          placeholder="@nettsted"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                        />
                      </label>

                      <label className="grid gap-1">
                        <span className="font-medium text-[rgb(var(--lp-text))]">
                          Override language code reference
                        </span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">ISO Language Codes.</span>
                        <input
                          type="text"
                          placeholder="no"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                        />
                      </label>

                      <div className="grid gap-1">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Leseretning (content direction)</span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">
                          Velg om innhold skal vises venstre-til-høyre (LTR) eller høyre-til-venstre (RTL).
                        </span>
                        <div className="mt-2 flex gap-2">
                          {[
                            ["ltr", "LTR"],
                            ["rtl", "RTL"],
                          ].map(([value, label]) => {
                            const selected = contentDirection === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setContentDirection(value as "ltr" | "rtl")}
                                className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-4 py-3 text-sm ${selected
                                  ? "border-slate-400 bg-slate-50 text-[rgb(var(--lp-text))]"
                                  : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]"
                                  }`}
                              >
                                <span className="text-lg" aria-hidden>
                                  {value === "ltr" ? "–" : "–"}
                                </span>
                                <span className="font-medium">{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid gap-4 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-4">
                        <div className="grid gap-1">
                          <span className="font-medium text-[rgb(var(--lp-text))]">Global search results page</span>
                          <span className="text-xs text-[rgb(var(--lp-muted))]">
                            Hvis ingen side er valgt vil søkeskjemaet ikke vises.
                          </span>
                          <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white px-4 py-3 text-sm">
                            <div>
                              <p className="font-medium text-[rgb(var(--lp-text))]">Search</p>
                              <p className="text-xs text-[rgb(var(--lp-muted))]">/search/</p>
                            </div>
                            <button
                              type="button"
                              className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                            >
                              Fjern
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-1">
                          <span className="font-medium text-[rgb(var(--lp-text))]">Page not found</span>
                          <span className="text-xs text-[rgb(var(--lp-muted))]">
                            Vises hvis den forespurte URL-en ikke finnes.
                          </span>
                          <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white px-4 py-3 text-sm">
                            <div>
                              <p className="font-medium text-[rgb(var(--lp-text))]">Page not found</p>
                              <p className="text-xs text-[rgb(var(--lp-muted))]">/page-not-found/</p>
                            </div>
                            <button
                              type="button"
                              className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                            >
                              Fjern
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {contentSettingsTab === "analytics" && (
                  <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="grid gap-3">
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">
                          Google Analytics tracking ID
                        </span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">Besøk Google Analytics.</span>
                        <input
                          type="text"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                          placeholder="UA-XXXXXXX-X eller G-XXXXXXX"
                        />
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Google Tag Manager ID</span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">Besøk Google Tag Manager.</span>
                        <input
                          type="text"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                          placeholder="GTM-XXXXXXX"
                        />
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Facebook pixel</span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">Besøk Facebook.</span>
                        <input
                          type="text"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                          placeholder="Pixel ID"
                        />
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">X (Twitter) pixel</span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">Besøk X (Twitter).</span>
                        <input
                          type="text"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                          placeholder="Pixel ID"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {contentSettingsTab === "form" && (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="grid gap-4">
                      <div className="grid gap-1">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Email marketing platform</span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">
                          Hvære tilgjengelig.
                        </span>
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          {[
                            ["campaignMonitor", "CAMPAIGN MONITOR"],
                            ["mailchimp", "MAILCHIMP"],
                          ].map(([value, label]) => {
                            const selected = emailPlatform === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setEmailPlatform(value as "campaignMonitor" | "mailchimp")}
                                className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-3 text-xs font-medium ${selected
                                  ? "border-slate-400 bg-slate-50 text-[rgb(var(--lp-text))]"
                                  : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]"
                                  }`}
                              >
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">
                          Email marketing platform API key
                        </span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">
                          Hvis tom vil nyhetsbrev-påmelding ikke være tilgjengelig.
                        </span>
                        <input
                          type="text"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                        />
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">
                          Email marketing platform default subscriber list ID
                        </span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">
                          Brukes som standard liste for påmeldinger hvis ikke annet er angitt.
                        </span>
                        <input
                          type="text"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                        />
                      </label>

                      <div className="grid gap-1">
                        <span className="font-medium text-[rgb(var(--lp-text))]">CAPTCHA-versjon</span>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {[
                            ["recaptchaV2", "RECAPTCHA V2"],
                            ["recaptchaV3", "RECAPTCHA V3"],
                            ["hcaptcha", "HCAPTCHA"],
                            ["turnstile", "TURNSTILE"],
                          ].map(([value, label]) => {
                            const selected = captchaVersion === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() =>
                                  setCaptchaVersion(
                                    value as "recaptchaV2" | "recaptchaV3" | "hcaptcha" | "turnstile"
                                  )
                                }
                                className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-medium ${selected
                                  ? "border-slate-400 bg-slate-50 text-[rgb(var(--lp-text))]"
                                  : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]"
                                  }`}
                              >
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">
                        hCaptcha være aktiv på skjemaer hvis nøkkel og hemmelig nøkkel er lagt inn her.
                      </div>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">hCaptcha site key</span>
                        <input
                          type="text"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                        />
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">hCaptcha secret key</span>
                        <input
                          type="text"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {contentSettingsTab === "globalContent" && (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-[rgb(var(--lp-muted))]">
                      Innhold som legges til her vil vises på alle sider, med mindre det overstyres på sidenivå.
                    </div>
                    <div className="space-y-4">
                      {[
                        ["Top components", "Legg til innhold"],
                        ["Bottom components", "Legg til innhold"],
                        ["Pods", "Legg til innhold"],
                      ].map(([label, cta]) => (
                        <div key={label} className="grid gap-1 text-sm">
                          <span className="font-medium text-[rgb(var(--lp-text))]">{label}</span>
                          <button
                            type="button"
                            className="mt-1 flex min-h-[44px] items-center justify-between rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                          >
                            <span>{cta}</span>
                          </button>
                        </div>
                      ))}

                      <div className="grid gap-2">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Modal window</span>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          {["TIMED", "SCROLL"].map((label) => (
                            <button
                              key={label}
                              type="button"
                              className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border border-[rgb(var(--lp-border))] bg-white text-xs font-medium text-[rgb(var(--lp-muted))]"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {contentSettingsTab === "notification" && (
                  <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[rgb(var(--lp-text))]">Enable</p>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Slå på for å vise globale varsler på nettstedet.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={notificationEnabled}
                        onClick={() => setNotificationEnabled((v) => !v)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${notificationEnabled ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                          }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${notificationEnabled ? "translate-x-5" : "translate-x-0.5"
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {contentSettingsTab === "scripts" && (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    {[
                      [
                        "Header opening scripts",
                        "Alt som legges inn her plasseres rett etter åpning av <head>-taggen på alle sider.",
                      ],
                      [
                        "Header closing scripts",
                        "Alt som legges inn her plasseres rett før lukking av </head>-taggen på alle sider.",
                      ],
                      [
                        "After opening body scripts",
                        "Alt som legges inn her plasseres rett etter åpning av <body>-taggen på alle sider.",
                      ],
                      [
                        "Before closing body scripts",
                        "Alt som legges inn her plasseres rett før lukking av </body>-taggen på alle sider.",
                      ],
                    ].map(([label, helper]) => (
                      <div key={label} className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">{label}</span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">
                          {helper} Husk å pakke JavaScript i {"<script>"}-tagger.
                        </span>
                        <textarea
                          rows={4}
                          className="mt-1 w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {contentSettingsTab === "advanced" && (
                  <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[rgb(var(--lp-text))]">Disable delete</p>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Hvis aktivert, blokkeres sletting av denne noden og en advarsel vises.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        YES
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
                  <p className="text-xs text-[rgb(var(--lp-muted))]">Global / Innhold og innstillinger</p>
                  <div className="flex gap-2">
                    <button type="button" className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-green-700 hover:bg-slate-50">
                      Lagre
                    </button>
                    <button type="button" className="min-h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700">
                      Lagre og publiser
                    </button>
                  </div>
                </div>
              </div>
            ) : mainView === "global" && globalSubView === "reusable-components" ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setGlobalSubView(null)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                      aria-label="Tilbake til Global"
                    >
                      –
                    </button>
                    <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Reusable Components</h1>
                  </div>
                  <button
                    type="button"
                    className="hidden h-9 w-9 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))] md:flex"
                    aria-label="Søk"
                  >
                    –
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    className="min-h-9 rounded-lg bg-[rgb(var(--lp-text))] px-4 text-sm font-medium text-white hover:bg-slate-900"
                  >
                    Create Component Group
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { title: "Maps", components: 2, updated: "2025-03-15 11:36", createdBy: "uSkinned" },
                    { title: "Size Guide", components: 2, updated: "2025-03-15 11:36", createdBy: "uSkinned" },
                  ].map((group) => (
                    <article
                      key={group.title}
                      className="flex flex-col rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4"
                    >
                      <h2 className="text-base font-semibold text-[rgb(var(--lp-text))]">{group.title}</h2>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[rgb(var(--lp-muted))]">
                        <div>
                          <dt className="font-medium text-[rgb(var(--lp-text))]">Components</dt>
                          <dd>{group.components}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-[rgb(var(--lp-text))]">Status</dt>
                          <dd>Published</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-[rgb(var(--lp-text))]">Last edited</dt>
                          <dd>{group.updated}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-[rgb(var(--lp-text))]">Updated by</dt>
                          <dd>{group.createdBy}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-[rgb(var(--lp-text))]">Created by</dt>
                          <dd>{group.createdBy}</dd>
                        </div>
                      </dl>

                      <div className="mt-3 flex gap-2">
                        {Array.from({ length: group.components }).map((_, idx) => (
                          <div
                            key={idx}
                            className="h-16 flex-1 rounded-lg bg-slate-800"
                            aria-label="Komponentforhåndsvisning"
                          />
                        ))}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
                  <p className="text-xs text-[rgb(var(--lp-muted))]">Global / Reusable Components</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-green-700 hover:bg-slate-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="min-h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Save and publish
                    </button>
                  </div>
                </div>
              </div>
            ) : mainView === "global" && globalSubView === "header" ? (
              (() => {
                const headerVariants = [
                  { id: "public" as const, title: "Offentlig header", desc: "Forside og markedsføringssider (ikke innlogget). Logo, Hjem, Ukeplan m.m. Tabs styres i HeaderShell ved manglende rolle.", headerTitle: "Lunsjportalen", tabs: [{ label: "Hjem", href: "/home" }, { label: "Ukeplan", href: "/week" }] },
                  { id: "company-admin" as const, title: "Firma admin header", desc: "Bedriftsadministrator. Faner: Dashboard, Firma, Avtale, Locations, Ansatte, Meny, Innsikt, Historikk, ESG.", headerTitle: "Admin", tabs: [{ label: "Dashboard", href: "/admin", exact: true }, { label: "Firma", href: "/admin/companies" }, { label: "Avtale", href: "/admin/agreement" }, { label: "Locations", href: "/admin/locations" }, { label: "Ansatte", href: "/admin/employees" }, { label: "Meny", href: "/admin/menus" }, { label: "Innsikt", href: "/admin/insights" }, { label: "Historikk", href: "/admin/history" }, { label: "ESG", href: "/admin/baerekraft" }] },
                  { id: "superadmin" as const, title: "Superadmin header", desc: "Systemadministrasjon. Faner: Oversikt, CFO, Konsern, Firma, ESG, System, Audit.", headerTitle: "Superadmin", tabs: [{ label: "Oversikt", href: "/superadmin", exact: true }, { label: "CFO", href: "/superadmin/cfo" }, { label: "Konsern", href: "/superadmin/enterprise" }, { label: "Firma", href: "/superadmin/companies" }, { label: "ESG", href: "/superadmin/esg" }, { label: "System", href: "/superadmin/system" }, { label: "Audit", href: "/superadmin/audit" }] },
                  { id: "employee" as const, title: "Employee / ansatt header", desc: "Ansattportalen. Faner: Ukeplan, Mine bestillinger.", headerTitle: "Min lunsjordning", tabs: [{ label: "Ukeplan", href: "/week" }, { label: "Mine bestillinger", href: "/orders" }] },
                  { id: "kitchen" as const, title: "Kjøkkenheader", desc: "Kjøkken/produksjon. Faner: Produksjon i dag, Rapporter.", headerTitle: "Kjøkken", tabs: [{ label: "Produksjon i dag", href: "/kitchen" }, { label: "Rapporter", href: "/kitchen/report" }] },
                  { id: "driver" as const, title: "Driver header", desc: "Sjåfør/levering. Faner: Ruter i dag.", headerTitle: "Sjåfør", tabs: [{ label: "Ruter i dag", href: "/driver" }] },
                ];
                const selectedVariant = headerVariant ? headerVariants.find((v) => v.id === headerVariant) : null;
                return (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => (headerVariant ? setHeaderVariant(null) : setGlobalSubView(null))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                        aria-label={headerVariant ? "Tilbake til Headervarianter" : "Tilbake til Global"}
                      >
                        –
                      </button>
                      <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">
                        {selectedVariant ? selectedVariant.title : "Header"}
                      </h1>
                    </div>
                    {selectedVariant ? (
                      <div className="space-y-6">
                        <p className="text-sm text-[rgb(var(--lp-muted))]">{selectedVariant.desc}</p>

                        {headerEditLoading ? (
                          <p className="text-sm text-[rgb(var(--lp-muted))]">Laster …</p>
                        ) : headerEditError ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                            <p className="text-sm text-red-800">{headerEditError}</p>
                            <button
                              type="button"
                              onClick={() => setHeaderVariant(null)}
                              className="mt-2 text-sm font-medium text-red-700 underline"
                            >
                              Tilbake og prøv igjen
                            </button>
                          </div>
                        ) : headerEditConfig ? (
                          <>
                            <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Tittel i header</p>
                              <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Vises ved siden av logo (område-label).</p>
                              <input
                                type="text"
                                value={headerEditConfig.title}
                                onChange={(e) => setHeaderEditConfig((c) => (c ? { ...c, title: e.target.value } : c))}
                                className="mt-2 h-10 w-full max-w-md rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm text-[rgb(var(--lp-text))]"
                                aria-label="Tittel i header"
                              />
                            </div>

                            <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Faner i toppnav</p>
                              <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Legg til, fjern eller endre rekkefølge. Lagre nederst.</p>
                              <ul className="mt-3 space-y-2" role="list">
                                {headerEditConfig.nav.map((tab, idx) => (
                                  <li key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-2">
                                    <input
                                      type="text"
                                      value={tab.label}
                                      onChange={(e) =>
                                        setHeaderEditConfig((c) =>
                                          c
                                            ? {
                                              ...c,
                                              nav: c.nav.map((t, i) => (i === idx ? { ...t, label: e.target.value } : t)),
                                            }
                                            : c
                                        )
                                      }
                                      placeholder="Tekst på fanen"
                                      className="min-h-[44px] flex-1 min-w-[120px] rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                      aria-label={`Fane ${idx + 1} tekst`}
                                    />
                                    <input
                                      type="text"
                                      value={tab.href}
                                      onChange={(e) =>
                                        setHeaderEditConfig((c) =>
                                          c
                                            ? {
                                              ...c,
                                              nav: c.nav.map((t, i) => (i === idx ? { ...t, href: e.target.value } : t)),
                                            }
                                            : c
                                        )
                                      }
                                      placeholder="/path"
                                      className="min-h-[44px] w-32 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm font-mono"
                                      aria-label={`Fane ${idx + 1} lenke`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setHeaderEditConfig((c) =>
                                          c ? { ...c, nav: c.nav.filter((_, i) => i !== idx) } : c
                                        )
                                      }
                                      className="min-h-[44px] rounded-lg border border-red-200 bg-red-50 px-3 text-sm text-red-700 hover:bg-red-100"
                                      aria-label={`Fjern fane ${idx + 1}`}
                                    >
                                      Fjern
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              <button
                                type="button"
                                onClick={() =>
                                  setHeaderEditConfig((c) =>
                                    c ? { ...c, nav: [...c.nav, { label: "", href: "" }] } : c
                                  )
                                }
                                className="mt-3 flex min-h-[44px] items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                              >
                                + Legg til fane
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                disabled={headerEditSaving}
                                onClick={async () => {
                                  if (!headerVariant || !headerEditConfig) return;
                                  setHeaderEditSaving(true);
                                  setHeaderEditError(null);
                                  try {
                                    const res = await fetch(
                                      `/api/backoffice/content/header-config/${encodeURIComponent(headerVariant)}`,
                                      {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          title: headerEditConfig.title,
                                          nav: headerEditConfig.nav.filter((t) => t.label.trim() && t.href.trim()),
                                        }),
                                      }
                                    );
                                    const json = await res.json();
                                    if (!res.ok || !json?.ok) {
                                      setHeaderEditError(json?.message ?? `Feil ${res.status}`);
                                      return;
                                    }
                                    if (json?.data) {
                                      setHeaderEditConfig({
                                        title: json.data.title ?? headerEditConfig.title,
                                        nav: Array.isArray(json.data.nav) ? json.data.nav.map((x: { label?: string; href?: string }) => ({ label: String(x?.label ?? ""), href: String(x?.href ?? "") })) : headerEditConfig.nav,
                                      });
                                    }
                                  } catch (e) {
                                    setHeaderEditError(e instanceof Error ? e.message : "Kunne ikke lagre");
                                  } finally {
                                    setHeaderEditSaving(false);
                                  }
                                }}
                                className="min-h-[44px] rounded-lg bg-green-600 px-5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                              >
                                {headerEditSaving ? "Lagrer …" : "Lagre"}
                              </button>
                              {headerEditError ? <p className="text-sm text-red-600">{headerEditError}</p> : null}
                            </div>

                            <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Innstillinger</p>
                              <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                                Endringer lagres i databasen og brukes av HeaderShell på nettstedet.
                              </p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-[rgb(var(--lp-muted))]">
                          Alle headere bruker samme uttrykk (kanonisk HeaderShell). Knappene i toppnav er tilpasset hver rolle.
                        </p>
                        <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Logo</p>
                          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                            Logo og merkevare brukes fra /public/brand. Endringer gjøres i kode (AGENTS.md S10–S11).
                          </p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Headervarianter</p>
                          <p className="text-xs text-[rgb(var(--lp-muted))]">
                            Klikk på en variant for å se detaljer. Kun faner/knapper i toppnav endres etter rolle.
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {headerVariants.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => setHeaderVariant(v.id)}
                                className="flex min-h-[44px] w-full flex-col items-start rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                                aria-label={`Å ${v.title}`}
                              >
                                <p className="font-medium text-[rgb(var(--lp-text))]">{v.title}</p>
                                <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{v.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
                      <p className="text-xs text-[rgb(var(--lp-muted))]">
                        Global / Header{selectedVariant ? ` / ${selectedVariant.title}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })()
            ) : mainView === "global" && globalSubView === "footer" ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setGlobalSubView(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                    aria-label="Tilbake til Global"
                  >
                    –
                  </button>
                  <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Footer</h1>
                </div>

                <div className="flex flex-wrap gap-1 border-b border-[rgb(var(--lp-border))] pb-2">
                  {(["content", "advanced"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setFooterTab(tab)}
                      className={`min-h-9 rounded-t-lg border px-3 text-sm font-medium ${footerTab === tab
                        ? "border-[rgb(var(--lp-border))] border-b-0 bg-white text-[rgb(var(--lp-text))] -mb-px"
                        : "border-transparent text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                        }`}
                    >
                      {tab === "content" ? "Content" : "Advanced"}
                    </button>
                  ))}
                </div>

                {footerTab === "content" ? (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Footer items</p>
                      <div className="space-y-2 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3">
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))]"
                          >
                            <div className="h-14 w-24 rounded-lg bg-slate-800" aria-hidden />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-[rgb(var(--lp-text))]">Code</p>
                              <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                                COMPONENT: CODE · COLUMN WIDTH: DESKTOP: 12 | TABLET: 12
                              </p>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          className="mt-1 flex h-11 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                        >
                          Legg til innhold
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Copyright message</span>
                        <input
                          type="text"
                          placeholder="Melhus Catering Gruppen"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                        />
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Site credit label</span>
                        <input
                          type="text"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                        />
                      </label>

                      <div className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Site credit link</span>
                        <button
                          type="button"
                          className="mt-1 flex h-11 items-center justify-between rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                        >
                          <span>Add</span>
                          <span className="text-[11px] text-[rgb(var(--lp-muted))]">Add up to 1 items</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[rgb(var(--lp-text))]">Disable delete</p>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Hvis  ««Yes «» er valgt, vil forsøk på å slette denne noden blokkeres og en advarsel vises.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        YES
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
                  <p className="text-xs text-[rgb(var(--lp-muted))]">Global / Footer</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-green-700 hover:bg-slate-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="min-h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Save and publish
                    </button>
                  </div>
                </div>
              </div>
            ) : mainView === "global" && globalSubView === "navigation" ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setGlobalSubView(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                    aria-label="Tilbake til Global"
                  >
                    –
                  </button>
                  <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Navigation</h1>
                </div>

                <div className="flex flex-wrap gap-1 border-b border-[rgb(var(--lp-border))] pb-2">
                  {(
                    [
                      ["main", "Main"],
                      ["secondary", "Secondary"],
                      ["footer", "Footer"],
                      ["member", "Member"],
                      ["cta", "CTA"],
                      ["language", "Language"],
                      ["advanced", "Advanced"],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setNavigationTab(tab)}
                      className={`min-h-9 rounded-t-lg border px-3 text-sm font-medium ${navigationTab === tab
                        ? "border-[rgb(var(--lp-border))] border-b-0 bg-white text-[rgb(var(--lp-text))] -mb-px"
                        : "border-transparent text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {navigationTab === "main" ? (
                  <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide main navigation</p>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Hvis aktivert skjules hovednavigasjonen på nettstedet.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={hideMainNavigation}
                          onClick={() => setHideMainNavigation((v) => !v)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideMainNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideMainNavigation ? "translate-x-5" : "translate-x-0.5"
                              }`}
                          />
                        </button>
                        <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                          {hideMainNavigation ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Main navigation</p>
                      <div className="space-y-2 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3">
                        {[
                          "Hjem",
                          "Butikk",
                          "Guider",
                          "Oliven",
                          "Olivenolje",
                          "Kontakt",
                          "Om oss",
                          "Smaksopplevelse",
                        ].map((label, index) => (
                          <div
                            key={label}
                            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))]"
                          >
                            <button
                              type="button"
                              className="mr-1 flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-[rgb(var(--lp-border))] text-xs text-[rgb(var(--lp-muted))]"
                              aria-label="Flytt"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="flex h-7 items-center rounded-md border border-dashed border-[rgb(var(--lp-border))] px-2 text-xs text-[rgb(var(--lp-muted))]"
                            >
                              Icon
                            </button>
                            <button
                              type="button"
                              className="flex h-7 items-center rounded-md border border-dashed border-[rgb(var(--lp-border))] px-2 text-xs text-[rgb(var(--lp-muted))]"
                            >
                              Rel
                            </button>
                            <div className="mx-2 flex-1 truncate font-medium">
                              {index === 0 ? (
                                <span className="inline-flex items-center gap-1">
                                  <span aria-hidden>⌂ </span>
                                  <span>{label}</span>
                                </span>
                              ) : (
                                label
                              )}
                            </div>
                            <button
                              type="button"
                              className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              className="ml-1 flex h-8 w-8 items-center justify-center rounded-md bg-slate-600 text-white"
                              aria-label="Slett"
                            >
                              –
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="flex h-9 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ) : navigationTab === "secondary" ? (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide secondary navigation</p>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Velg hvilke lenker som skal vises i  ««Secondary Navigation «».
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={hideSecondaryNavigation}
                          onClick={() => setHideSecondaryNavigation((v) => !v)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideSecondaryNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideSecondaryNavigation ? "translate-x-5" : "translate-x-0.5"
                              }`}
                          />
                        </button>
                        <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                          {hideSecondaryNavigation ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Secondary navigation</p>
                      <p className="max-w-xl text-xs text-[rgb(var(--lp-muted))]">
                        Velg sidene som skal vises i secondary navigation. Feltet  ««Link title «» brukes som lenketekst.
                      </p>
                      <button
                        type="button"
                        className="mt-1 flex h-11 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ) : navigationTab === "footer" ? (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide footer navigation</p>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Velg hvilke lenker som skal vises i footer navigation.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={hideFooterNavigation}
                          onClick={() => setHideFooterNavigation((v) => !v)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideFooterNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideFooterNavigation ? "translate-x-5" : "translate-x-0.5"
                              }`}
                          />
                        </button>
                        <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                          {hideFooterNavigation ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Footer navigation</p>
                      <p className="max-w-xl text-xs text-[rgb(var(--lp-muted))]">
                        Velg sidene som skal vises i footer navigation. Feltet  ««Link title «» brukes som lenketekst.
                      </p>

                      <div className="space-y-2 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3">
                        {["Terms & Conditions", "Privacy Policy", "Sitemap"].map((label) => (
                          <div
                            key={label}
                            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))]"
                          >
                            <button
                              type="button"
                              className="mr-1 flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-[rgb(var(--lp-border))] text-xs text-[rgb(var(--lp-muted))]"
                              aria-label="Flytt"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="flex h-7 items-center rounded-md border border-dashed border-[rgb(var(--lp-border))] px-2 text-xs text-[rgb(var(--lp-muted))]"
                            >
                              Icon
                            </button>
                            <button
                              type="button"
                              className="flex h-7 items-center rounded-md border border-dashed border-[rgb(var(--lp-border))] px-2 text-xs text-[rgb(var(--lp-muted))]"
                            >
                              Rel
                            </button>
                            <div className="mx-2 flex-1 truncate font-medium">{label}</div>
                            <button
                              type="button"
                              className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              className="ml-1 flex h-8 w-8 items-center justify-center rounded-md bg-slate-600 text-white"
                              aria-label="Slett"
                            >
                              –
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="flex h-9 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ) : navigationTab === "member" ? (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide member navigation</p>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Skjul eller vis egen navigasjon for innloggede/utloggede medlemmer.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={hideMemberNavigation}
                          onClick={() => setHideMemberNavigation((v) => !v)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideMemberNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideMemberNavigation ? "translate-x-5" : "translate-x-0.5"
                              }`}
                          />
                        </button>
                        <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                          {hideMemberNavigation ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-[rgb(var(--lp-text))]">Navigation heading</span>
                        <span className="text-xs text-[rgb(var(--lp-muted))]">
                          Overstyrer standard overskrift definert i ordboken.
                        </span>
                        <input
                          type="text"
                          className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                        />
                      </label>

                      <div className="space-y-3 text-sm">
                        <div className="space-y-1">
                          <p className="font-medium text-[rgb(var(--lp-text))]">Logged in members navigation</p>
                          <p className="max-w-xl text-xs text-[rgb(var(--lp-muted))]">
                            Velg sidene som skal vises i navigasjonen for innloggede medlemmer.
                          </p>
                          <button
                            type="button"
                            className="mt-1 flex h-11 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                          >
                            Add
                          </button>
                        </div>

                        <div className="space-y-1">
                          <p className="font-medium text-[rgb(var(--lp-text))]">Logged out members navigation</p>
                          <p className="max-w-xl text-xs text-[rgb(var(--lp-muted))]">
                            Velg sidene som skal vises i navigasjonen for utloggede medlemmer.
                          </p>
                          <button
                            type="button"
                            className="mt-1 flex h-11 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : navigationTab === "cta" ? (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide CTA navigation</p>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Sitewide call–to–action–knapper som brukes i hovednavigasjonen.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={hideCtaNavigation}
                          onClick={() => setHideCtaNavigation((v) => !v)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideCtaNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideCtaNavigation ? "translate-x-5" : "translate-x-0.5"
                              }`}
                          />
                        </button>
                        <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                          {hideCtaNavigation ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
                        Sitewide call to action buttons
                      </p>
                      <p className="max-w-xl text-xs text-[rgb(var(--lp-muted))]">
                        Disse knappene brukes som hoved–call–to–actions og vises på en fremtredende plass.
                      </p>
                      <button
                        type="button"
                        className="mt-1 flex h-11 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ) : navigationTab === "language" ? (
                  <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-[rgb(var(--lp-muted))]">
                      <p className="mb-1 font-medium text-[rgb(var(--lp-text))]">
                        To tilnærminger til flerspråklige nettsteder
                      </p>
                      <p className="text-xs">
                        <span className="font-semibold">Multi Site</span> – flere hjemmesider innenfor samme nettsted,
                        hver med egne sider per språk.
                      </p>
                      <p className="mt-1 text-xs">
                        <span className="font-semibold">One to One</span> – hver innholdnode finnes i flere språkvarianter
                        og språk–navigasjonen genereres automatisk.
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide language navigation</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={hideLanguageNavigation}
                          onClick={() => setHideLanguageNavigation((v) => !v)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideLanguageNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideLanguageNavigation ? "translate-x-5" : "translate-x-0.5"
                              }`}
                          />
                        </button>
                        <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                          {hideLanguageNavigation ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Multilingual configuration</p>
                      <div className="mt-1 flex gap-2">
                        {[
                          ["multiSite", "MULTI SITE"],
                          ["oneToOne", "ONE TO ONE"],
                        ].map(([value, label]) => {
                          const selected = multilingualMode === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setMultilingualMode(value as "multiSite" | "oneToOne")}
                              className={`min-h-10 rounded-full px-4 text-xs font-semibold ${selected
                                ? "bg-slate-600 text-white"
                                : "border border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]"
                                }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[rgb(var(--lp-text))]">Disable delete</p>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">
                          Hvis  ««Yes «» er valgt vil sletting av denne noden blokkeres og en advarsel vises.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        YES
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
                  <p className="text-xs text-[rgb(var(--lp-muted))]">Global / Navigation</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-green-700 hover:bg-slate-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="min-h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Save and publish
                    </button>
                  </div>
                </div>
              </div>
            ) : mainView === "global" ? (
              <div className="space-y-6">
                <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Global</h1>
                <div className="flex gap-1 border-b border-[rgb(var(--lp-border))] pb-2">
                  {(["global", "content", "info"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setGlobalPanelTab(tab)}
                      className={`min-h-9 rounded-t-lg border px-4 text-sm font-medium ${globalPanelTab === tab
                        ? "border-[rgb(var(--lp-border))] border-b-0 bg-white text-[rgb(var(--lp-text))] -mb-px"
                        : "border-transparent text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                        }`}
                    >
                      {tab === "global" ? "Global" : tab === "content" ? "Content" : "Info"}
                    </button>
                  ))}
                </div>
                {globalPanelTab === "global" ? (
                  <div className="space-y-4">
                    <p className="text-sm text-[rgb(var(--lp-muted))]">
                      Administrer globalt innhold og innstillinger for nettstedet.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          id: "content-and-settings",
                          title: "Innhold og innstillinger",
                          description: "Administrer det globale innholdet og innstillingene som gjelder for nettstedet.",
                          icon: "–",
                        },
                        {
                          id: "header",
                          title: "Header",
                          description: "Administrer header for det offentlige nettstedet (logo, faner, innlogging).",
                          icon: "⊞",
                        },
                        {
                          id: "navigation",
                          title: "Navigasjon",
                          description: "Administrer de globale navigasjonsmenyene på nettstedet.",
                          icon: "–",
                        },
                        {
                          id: "footer",
                          title: "Footer",
                          description: "Opprett og administrer global footer.",
                          icon: "⊞",
                        },
                        {
                          id: "reusable-components",
                          title: "Gjenbrukbare komponenter",
                          description: "Opprett og administrer komponentgrupper som kan brukes på tvers av nettstedet.",
                          icon: "–",
                        },
                        {
                          id: null,
                          title: "Gjenbrukbare pods",
                          description:
                            "Opprett og administrer pods som kan legges til flere steder. Ås i et modalt vindu.",
                          icon: "–",
                        },
                      ].map((card) => (
                        <button
                          key={card.title}
                          type="button"
                          onClick={() => {
                            if (card.id === "content-and-settings") setGlobalSubView("content-and-settings");
                            if (card.id === "header") setGlobalSubView("header");
                            if (card.id === "navigation") setGlobalSubView("navigation");
                            if (card.id === "footer") setGlobalSubView("footer");
                            if (card.id === "reusable-components") setGlobalSubView("reusable-components");
                          }}
                          className="flex w-full items-start gap-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                          title={card.id ? undefined : "Kommer snart"}
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-lg text-slate-600">
                            {card.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[rgb(var(--lp-text))]">{card.title}</p>
                            <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">{card.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : globalPanelTab === "content" ? (
                  <p className="text-sm text-[rgb(var(--lp-muted))]">Content-fane. Kommer snart.</p>
                ) : (
                  <p className="text-sm text-[rgb(var(--lp-muted))]">Info-fane. Kommer snart.</p>
                )}
              </div>
            ) : !selectedId ? (
              <>
                {/* I3 – Tom tilstand */}
                <h1 className="text-xl font-semibold text-[rgb(var(--lp-text))]">Velg en side for å redigere</h1>
                <div className="mt-4 rounded-lg border border-[rgb(var(--lp-border))] bg-white p-6 text-center">
                  <p className="text-sm text-[rgb(var(--lp-muted))]">Velg side i listen til venstre</p>
                </div>
              </>
            ) : pageNotFound ? (
              <div className="mt-4 rounded-lg border border-[rgb(var(--lp-border))] bg-white p-4 text-center">
                <h2 className="text-lg font-semibold text-[rgb(var(--lp-text))]">Siden finnes ikke</h2>
                <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
                  Den kan ha blitt slettet eller flyttet.
                </p>
                <button
                  type="button"
                  onClick={() => guardedPush("/backoffice/content")}
                  className="mt-4 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50"
                >
                  Tilbake til oversikt
                </button>
              </div>
            ) : detailLoading ? (
              <div className="mt-4 rounded-lg border border-[rgb(var(--lp-border))] bg-white p-4 text-sm text-[rgb(var(--lp-muted))]">
                Loading page...
              </div>
            ) : detailError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {detailError}
              </div>
            ) : page && hasConflict ? (
              <>
                {/* I1 – statuslinje over konfliktpanelet */}
                <div
                  role="status"
                  className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm text-[rgb(var(--lp-text))]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusLine.tone}`} key={statusLine.key}>
                      {statusLine.label}
                    </span>
                    {supportSnapshot && (
                      <>
                        {/* I4 – Kopier support-snapshot */}
                        <button type="button" onClick={() => void copySupportSnapshot()} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                          Kopier
                        </button>
                        {supportCopyFeedback === "ok" && <span className="text-xs text-green-700">Kopiert</span>}
                        {supportCopyFeedback === "fail" && <span className="text-xs text-slate-500">Kunne ikke kopiere</span>}
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {statusLine.actions.reload && !isOffline && (
                      <button type="button" onClick={onReloadFromServer} disabled={isOffline} title={isOffline ? "Du er offline" : undefined} className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                        Last på nytt
                      </button>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-center">
                  <p className="text-sm text-amber-800">Last serverversjon på nytt for å fortsette.</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <button type="button" onClick={onReloadFromServer} disabled={isOffline} title={isOffline ? "Du er offline" : undefined} className="rounded-lg border border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60">
                      Last på nytt
                    </button>
                    <button type="button" onClick={() => guardedPush("/backoffice/content")} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      Tilbake til oversikt
                    </button>
                  </div>
                </div>
              </>
            ) : page ? (
              useEditor2 && editor2Model !== null ? (
                <Editor2Shell
                  page={{ id: page.id, title: page.title ?? "", slug: page.slug ?? "", body: page.body, status: page.status }}
                  initialModel={editor2Model}
                  onModelChange={setEditor2Model}
                  selectedBlockId={editor2SelectedBlockId}
                  onSelectBlock={(id) => {
                    editor2PendingFocusIdRef.current = id;
                    setEditor2SelectedBlockId(id);
                  }}
                  statusLine={statusLine}
                  onPublish={() => {
                    if (editor2Validation.total > 0) {
                      if (editor2Validation.firstId) setEditor2SelectedBlockId(editor2Validation.firstId);
                      setEditor2FocusNonce((n) => n + 1);
                      return;
                    }
                    void onSetStatus("published");
                  }}
                  onUnpublish={() => void onSetStatus("draft")}
                  onSave={() => void performSave()}
                  onReload={onReloadFromServer}
                  canPublish={canPublish}
                  canUnpublish={canUnpublish}
                  canSave={canSave}
                  isPublished={isPublished}
                  errorsById={editor2Validation.byId}
                  publishDisabled={editor2Validation.total > 0 || !canPublish}
                  focusNonce={editor2FocusNonce}
                  blockListRef={editor2BlockListRef}
                  resetSearchNonce={editor2ResetSearchNonce}
                  validationTotal={editor2Validation.total}
                  onBumpFocusNonce={() => setEditor2FocusNonce((n) => n + 1)}
                />
              ) : (
                <div
                  className={
                    SHELL_V1
                      ? "mt-2 grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
                      : "mt-2 space-y-2"
                  }
                >
                  <div className="min-w-0 w-full space-y-2">
                    {/* U1 – command center top bar (Umbraco-style) */}
                    <ContentTopbar
                      statusBadgeClass={statusTone(statusLabel)}
                      statusLabel={statusLabel}
                      title={page.title || "Untitled"}
                      slug={page.slug || "—"}
                      statusLine={statusLine}
                      supportSnapshot={supportSnapshot}
                      supportCopyFeedback={supportCopyFeedback}
                      canPublish={canPublish}
                      canUnpublish={canUnpublish}
                      selectedId={selectedId}
                      pageExists={!!page}
                      isOffline={isOffline}
                      publishDisabledTitle={publishDisabledTitle}
                      unpublishDisabledTitle={unpublishDisabledTitle}
                      onCopySupportSnapshot={() => void copySupportSnapshot()}
                      onRetrySave={() => void performSave()}
                      onReload={onReloadFromServer}
                      onPublish={async () => {
                        if (canSave) await onSave();
                        if (canPublish) void onSetStatus("published");
                      }}
                      onUnpublish={() => void onSetStatus("draft")}
                    />
                    {recoveryBannerVisible && outboxData && (
                      <div
                        role="alert"
                        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
                      >
                        {hasFingerprintConflict && (
                          <p className="mb-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                            Serveren har nyere versjon. Gjenoppretting er deaktivert.
                          </p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-3">
                            {/* E2 – outbox status per item */}
                            {(() => {
                              const st = getOutboxUiStatus(outboxData);
                              const toneClass =
                                st.tone === "danger"
                                  ? "border-red-300 bg-red-50 text-red-800"
                                  : st.tone === "warn"
                                    ? "border-amber-300 bg-amber-50 text-amber-800"
                                    : "border-slate-300 bg-slate-50 text-slate-700";
                              return (
                                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
                                  {st.label}
                                </span>
                              );
                            })()}
                            <span className="font-medium">Ulagret utkast funnet.</span>
                            {/* E1 – outbox timestamp per item */}
                            <span className="text-amber-800">
                              {outboxData.savedAtLocal
                                ? `Sist forsøkt: ${formatDate(outboxData.savedAtLocal)}`
                                : "Tid: ukjent"}
                              {outboxData.updatedAtSeen ? ` · Sist sett på server: ${formatDate(outboxData.updatedAtSeen)}` : ""}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setOutboxDetailsExpanded((v) => !v)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {outboxDetailsExpanded ? "Skjul detaljer" : "Vis detaljer"}
                            </button>
                            {/* E1 – Kopier outbox snapshot */}
                            <button
                              type="button"
                              onClick={() => copyOutboxSafetyExport(outboxData)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Kopier
                            </button>
                            {outboxCopyFeedback[getOutboxEntryKey(outboxData)] === "ok" && <span className="text-xs text-green-700">Kopiert</span>}
                            {outboxCopyFeedback[getOutboxEntryKey(outboxData)] === "fail" && <span className="text-xs text-slate-500">Kunne ikke kopiere</span>}
                            <button
                              type="button"
                              onClick={onRestoreOutbox}
                              disabled={hasFingerprintConflict}
                              className="rounded-lg border border-amber-500 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Gjenopprett
                            </button>
                            <button
                              type="button"
                              onClick={onDiscardOutbox}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Forkast
                            </button>
                          </div>
                        </div>
                        {outboxDetailsExpanded && (
                          <div className="mt-3 space-y-2 border-t border-amber-200 pt-3 text-xs">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
                              <span className="text-amber-800">pageId</span>
                              <span className="font-mono">{outboxData.pageId}</span>
                              <span className="text-amber-800">savedAtLocal</span>
                              <span>{formatDate(outboxData.savedAtLocal)}</span>
                              <span className="text-amber-800">updatedAtSeen</span>
                              <span>{outboxData.updatedAtSeen ? formatDate(outboxData.updatedAtSeen) : "—"}</span>
                              <span className="text-amber-800">fingerprint</span>
                              <span className="font-mono truncate" title={outboxData.fingerprint}>{outboxData.fingerprint}</span>
                              <span className="text-amber-800">draft.title</span>
                              <span>{outboxData.draft.title || "—"}</span>
                              <span className="text-amber-800">draft.slug</span>
                              <span>{outboxData.draft.slug || "—"}</span>
                              <span className="text-amber-800">draft.status</span>
                              <span>{outboxData.draft.status}</span>
                            </div>
                            <div>
                              <div className="mb-1 font-medium text-amber-800">draft (body som JSON)</div>
                              <pre className="max-h-64 overflow-auto rounded border border-amber-200 bg-white p-2 font-mono text-xs text-slate-800">
                                {JSON.stringify(outboxData.draft, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* U1 – typography/spacing tightening */}
                    <label className="block">
                      <span className="sr-only">Sidetittel</span>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Sidetittel (f.eks. Hjem)"
                        className="mt-1.5 w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2.5 text-base font-medium text-[rgb(var(--lp-text))] outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
                      />
                    </label>

                    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[rgb(var(--lp-border))] bg-white px-1 pt-1.5 pb-1">
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            ["innhold", "Innhold"],
                            ["ekstra", "Ekstra innhold"],
                            ["oppsummering", "Oppsummering"],
                            ["navigasjon", "Navigasjon"],
                            ["seo", "SEO & deling"],
                            ["scripts", "Scripts"],
                            ["avansert", "Avansert"],
                          ] as const
                        ).map(([tab, label]) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`min-h-[40px] rounded-t-lg border border-b-0 px-4 text-sm font-medium ${activeTab === tab
                              ? "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-text))]"
                              : "border-transparent bg-transparent text-[rgb(var(--lp-muted))] hover:bg-white/80"
                              }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pb-1 pr-1 text-xs text-[rgb(var(--lp-muted))]">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-medium ${statusTone(
                            statusLabel
                          )}`}
                        >
                          {statusLabel}
                        </span>
                        <span>Oppdatert {formatDate(page.updated_at)}</span>
                        <span className="ml-2 hidden md:inline">ID: {page.id}</span>
                        {canOpenPublic && (
                          <button
                            type="button"
                            onClick={onOpenPublicPage}
                            className="ml-2 inline-flex items-center gap-1 rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1 text-[11px] font-medium text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))]/60 hover:text-[rgb(var(--lp-text))]"
                          >
                            <span aria-hidden>↗</span>
                            <span>Åpne offentlig side</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {isContentTab && (
                      <div
                        className={`space-y-3 rounded-b-lg rounded-t-lg border border-t-0 border-[rgb(var(--lp-border))] bg-white p-3 ${
                          showPreview ? "lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-4 lg:items-start" : ""
                        }`}
                      >
                        <div className="space-y-4 min-w-0">
                          {/* Page setup */}
                          <section className="space-y-3 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 p-3">
                            {/* Umbraco Core Patch A – Document Type (single source of truth) */}
                            <div className="space-y-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Document Type</h3>
                              <div className="border-b border-[rgb(var(--lp-border))]" aria-hidden />
                              <div className="pt-1">
                                <label htmlFor="doc-type-select" className="sr-only">
                                  Dokumenttype
                                </label>
                                <select
                                  id="doc-type-select"
                                  value={documentTypeAlias ?? ""}
                                  onChange={(e) => {
                                    const next = e.target.value.trim() || null;
                                    setDocumentTypeAlias(next);
                                    if (next !== documentTypeAlias) setEnvelopeFields({});
                                  }}
                                  className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))] outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
                                  aria-label="Velg dokumenttype"
                                >
                                  <option value="">— Ingen dokumenttype —</option>
                                  {documentTypes.map((dt) => (
                                    <option key={dt.alias} value={dt.alias}>
                                      {dt.name}
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
                                  Dokumenttypen styrer tillatte undernoder og egenskapsfelt.
                                </p>
                              </div>
                            </div>
                            {/* Layout / page chrome */}
                            <div className="space-y-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Layout</h3>
                              <div className="border-b border-[rgb(var(--lp-border))]" aria-hidden />
                              <div className="grid gap-2 pt-1">
                                <div className="flex flex-wrap gap-3">
                                  {(
                                    [
                                      ["full", "FULL"],
                                      ["left", "LEFT"],
                                      ["right", "RIGHT"],
                                      ["centerNavLeft", "CENTER (NAV LEFT)"],
                                      ["centerNavRight", "CENTER (NAV RIGHT)"],
                                    ] as const
                                  ).map(([value, label]) => {
                                    const currentLayout = safeStr((meta as { layout?: unknown }).layout) || "full";
                                    const selected = currentLayout === value;
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        onClick={() =>
                                          setMeta((prev) => ({ ...prev, layout: value }))
                                        }
                                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition ${
                                          selected
                                            ? "border-slate-400 bg-slate-50"
                                            : "border-[rgb(var(--lp-border))] bg-white hover:border-slate-300"
                                        }`}
                                        title={label}
                                      >
                                        <LayoutThumbnail layout={value} />
                                        <span className="text-xs font-medium text-[rgb(var(--lp-text))]">{label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="text-[rgb(var(--lp-muted))]">Skjul sidetitler</span>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={Boolean(safeObj(meta).hidePageHeadings)}
                                    onClick={() =>
                                      setMeta((prev) => ({ ...prev, hidePageHeadings: !safeObj(prev).hidePageHeadings }))
                                    }
                                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors ${
                                      safeObj(meta).hidePageHeadings
                                        ? "border-slate-500 bg-slate-500"
                                        : "border-[rgb(var(--lp-border))] bg-slate-200"
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                        safeObj(meta).hidePageHeadings ? "translate-x-5" : "translate-x-0.5"
                                      }`}
                                    />
                                  </button>
                                  <span className="text-xs font-medium text-[rgb(var(--lp-muted))]">
                                    {safeObj(meta).hidePageHeadings ? "JA" : "NEI"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </section>

                          {/* Main content / blocks */}
                          <section className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                                  Main content
                                </h3>
                                <p className="mt-0.5 text-[11px] text-[rgb(var(--lp-muted))]">
                                  Bygg siden blokk for blokk. Rekkefølgen her er rekkefølgen på den offentlige siden.
                                </p>
                              </div>
                              {showBlocks && (
                                <button
                                  type="button"
                                  onClick={() => setShowPreviewColumn((v) => !v)}
                                  className="whitespace-nowrap text-xs text-[rgb(var(--lp-muted))] underline hover:text-[rgb(var(--lp-text))]"
                                >
                                  {showPreviewColumn ? "Skjul forhåndsvisning" : "Vis forhåndsvisning"}
                                </button>
                              )}
                            </div>
                            <div className="border-b border-[rgb(var(--lp-border))]" aria-hidden />
                            <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 p-3 pt-3">

                              {bodyMode === "legacy" && (
                                <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                  <p>Legacy body detected. Convert to blocks to use builder.</p>
                                  <button
                                    type="button"
                                    onClick={onConvertLegacyBody}
                                    className="min-h-[36px] rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium"
                                  >
                                    Convert to blocks
                                  </button>
                                </div>
                              )}

                              {bodyMode === "invalid" && (
                                <div className="mt-3 space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                                  <p>{bodyParseError || "Invalid body format."}</p>
                                  <button
                                    type="button"
                                    onClick={onResetInvalidBody}
                                    className="min-h-[36px] rounded-lg border border-red-300 bg-white px-3 text-sm font-medium"
                                  >
                                    Reset to blocks
                                  </button>
                                </div>
                              )}

                              {showBlocks && (
                                <div className="space-y-2">
                                  {blocks.length === 0 ? (
                                    <>
                                      {isForsidePage() ? (
                                        <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-slate-50 p-4">
                                          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
                                            Denne siden tilsvarer forsiden. Bygg den lik som i repoet med hero, tekster, bilder og CTA-er.
                                          </p>
                                          <button
                                            type="button"
                                            onClick={onFillForsideFromRepo}
                                            className="mt-3 min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-slate-100"
                                            aria-label="Bygg forside fra repo"
                                          >
                                            Bygg forside fra repo
                                          </button>
                                        </div>
                                      ) : null}
                                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-white px-4 py-6 text-center">
                                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[rgb(var(--lp-border))] text-xl text-[rgb(var(--lp-muted))]">
                                          +
                                        </div>
                                        <h3 className="text-sm font-medium text-[rgb(var(--lp-text))]">Ingen blokker ennå</h3>
                                        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                                          Bygg siden med blokker. Klikk under for å legge til din første blokk.
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            addInsertIndexRef.current = blocks.length;
                                            setBlockPickerOpen(true);
                                          }}
                                          className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-2 text-sm font-medium text-[rgb(var(--lp-text))] hover:border-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))]/60"
                                        >
                                          <span className="text-lg leading-none">+</span>
                                          Legg til blokk
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    blocks.map((block, index) => {
                                      const open = expandedBlockId === block.id;

                                      return (
                                        /* U1 – blocks as objects (Umbraco feel) */
                                        <article
                                          key={block.id}
                                          className="border-b border-[rgb(var(--lp-border))] bg-white last:border-b-0"
                                        >
                                          <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => onToggleBlock(block.id)}
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                onToggleBlock(block.id);
                                              }
                                            }}
                                            className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-[rgb(var(--lp-card))]/40"
                                          >
                                            <span
                                              className="flex h-8 w-6 shrink-0 items-center justify-center text-[rgb(var(--lp-muted))]"
                                              aria-hidden
                                              title="Drag handle"
                                            >
                                              ++
                                            </span>
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--lp-border))] bg-white/80 text-[rgb(var(--lp-muted))] text-[11px] font-medium">
                                              {block.type === "hero" ? (
                                                <span className="font-bold">H</span>
                                              ) : block.type === "richText" ? (
                                                <span className="font-mono">&lt;/&gt;</span>
                                              ) : block.type === "image" ? (
                                                <span>–</span>
                                              ) : block.type === "cta" ? (
                                                <span className="text-[10px] font-semibold">CTA</span>
                                              ) : block.type === "banners" ? (
                                                <span>–</span>
                                              ) : block.type === "code" ? (
                                                <span className="font-mono">&lt;/&gt;</span>
                                              ) : (
                                                <span>–</span>
                                              )}
                                            </span>
                                            <div className="min-w-0 flex-1 text-left">
                                              <div className="flex items-center gap-2">
                                                <span className="inline-flex shrink-0 items-center rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                                                  Blokk {index + 1}
                                                </span>
                                                <span className="truncate text-sm font-medium text-[rgb(var(--lp-text))]">
                                                  {getBlockLabel(block.type)}
                                                </span>
                                              </div>
                                              <div className="text-[11px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                                                COMPONENT: {blockTypeSubtitle(block.type, block)}
                                              </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                              <button
                                                type="button"
                                                onClick={() => { setEditIndex(index); setEditOpen(true); }}
                                                className="min-h-[26px] rounded border border-[rgb(var(--lp-border))] px-2 text-xs hover:bg-[rgb(var(--lp-card))]"
                                                title="Rediger blokk"
                                              >
                                                Rediger
                                              </button>
                                              <button
                                                type="button"
                                                disabled={index === 0}
                                                onClick={() => onMoveBlock(block.id, -1)}
                                                className="min-h-[26px] rounded border border-[rgb(var(--lp-border))] px-2 text-xs disabled:opacity-40"
                                                title="Flytt opp"
                                              >
                                                +
                                              </button>
                                              <button
                                                type="button"
                                                disabled={index === blocks.length - 1}
                                                onClick={() => onMoveBlock(block.id, 1)}
                                                className="min-h-[26px] rounded border border-[rgb(var(--lp-border))] px-2 text-xs disabled:opacity-40"
                                                title="Flytt ned"
                                              >
                                                –
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => onDeleteBlock(block.id)}
                                                className="min-h-[26px] rounded border border-red-200 bg-red-50 px-2 text-xs text-red-700"
                                                title="Slett"
                                              >
                                                Slett
                                              </button>
                                            </div>
                                            <span className="text-xs text-[rgb(var(--lp-muted))]">{open ? "▼" : "▶"}</span>
                                          </div>

                                          {open ? (
                                            <div className="border-t border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-3 py-2">
                                              <div className="grid gap-2">
                                                {block.type === "hero" ? (
                                                  <>
                                                    <label className="grid gap-1 text-sm">
                                                      <span className="text-[rgb(var(--lp-muted))]">Bilde (URL)</span>
                                                      <div className="flex gap-2">
                                                        <input
                                                          value={block.imageUrl || ""}
                                                          onChange={(e) => {
                                                            const value = e.target.value;
                                                            setBlockById(block.id, (current) =>
                                                              current.type === "hero" ? { ...current, imageUrl: value } : current
                                                            );
                                                          }}
                                                          placeholder="https://... eller /path/til/bilde.jpg"
                                                          className="h-10 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                                        />
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setMediaPickerTarget({ blockId: block.id, field: "heroImageUrl" });
                                                            setMediaPickerOpen(true);
                                                          }}
                                                          className="shrink-0 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]"
                                                        >
                                                          Fra mediearkiv
                                                        </button>
                                                      </div>
                                                    </label>
                                                    {block.imageUrl ? (
                                                      <label className="grid gap-1 text-sm">
                                                        <span className="text-[rgb(var(--lp-muted))]">Bilde alt-tekst</span>
                                                        <input
                                                          value={block.imageAlt || ""}
                                                          onChange={(e) => {
                                                            const value = e.target.value;
                                                            setBlockById(block.id, (current) =>
                                                              current.type === "hero" ? { ...current, imageAlt: value } : current
                                                            );
                                                          }}
                                                          placeholder="Beskriv bildet for tilgjengelighet"
                                                          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                                        />
                                                      </label>
                                                    ) : null}
                                                    <label className="grid gap-1 text-sm">
                                                      <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[rgb(var(--lp-muted))]">Title</span>
                                                        <button
                                                          type="button"
                                                          className="inline-flex items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
                                                          disabled={isOffline || !effectiveId || aiBusyToolId === "experiment.generate.variants"}
                                                          onClick={() =>
                                                            handleAiStructuredIntent?.(
                                                              { variantCount: 2, target: "hero_only" },
                                                              { fromPanel: false }
                                                            )
                                                          }
                                                        >
                                                          {aiBusyToolId === "experiment.generate.variants" ? "Kjører…" : "Generer bedre overskrift"}
                                                        </button>
                                                      </div>
                                                      <input
                                                        value={block.title}
                                                        onChange={(e) => {
                                                          const value = e.target.value;
                                                          setBlockById(block.id, (current) =>
                                                            current.type === "hero" ? { ...current, title: value } : current
                                                          );
                                                        }}
                                                        className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                                      />
                                                    </label>
                                                    <label className="grid gap-1 text-sm">
                                                      <span className="text-[rgb(var(--lp-muted))]">Subtitle</span>
                                                      <input
                                                        value={block.subtitle || ""}
                                                        onChange={(e) => {
                                                          const value = e.target.value;
                                                          setBlockById(block.id, (current) =>
                                                            current.type === "hero" ? { ...current, subtitle: value } : current
                                                          );
                                                        }}
                                                        className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                                      />
                                                    </label>
                                                    <div className="grid gap-2 md:grid-cols-2">
                                                      <label className="grid gap-1 text-sm">
                                                        <div className="flex items-center justify-between gap-2">
                                                          <span className="text-[rgb(var(--lp-muted))]">CTA label</span>
                                                          <button
                                                            type="button"
                                                            className="inline-flex items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
                                                            disabled={isOffline || !effectiveId || aiBusyToolId === "experiment.generate.variants"}
                                                            onClick={() =>
                                                              handleAiStructuredIntent?.(
                                                                { variantCount: 2, target: "hero_cta" },
                                                                { fromPanel: false }
                                                              )
                                                            }
                                                          >
                                                            {aiBusyToolId === "experiment.generate.variants" ? "Kjører…" : "Generer CTA-idéer"}
                                                          </button>
                                                        </div>
                                                        <input
                                                          value={block.ctaLabel || ""}
                                                          onChange={(e) => {
                                                            const value = e.target.value;
                                                            setBlockById(block.id, (current) =>
                                                              current.type === "hero" ? { ...current, ctaLabel: value } : current
                                                            );
                                                          }}
                                                          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                                        />
                                                      </label>
                                                      <label className="grid gap-1 text-sm">
                                                        <span className="text-[rgb(var(--lp-muted))]">CTA href</span>
                                                        <input
                                                          value={block.ctaHref || ""}
                                                          onChange={(e) => {
                                                            const value = e.target.value;
                                                            setBlockById(block.id, (current) =>
                                                              current.type === "hero" ? { ...current, ctaHref: value } : current
                                                            );
                                                          }}
                                                          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                                        />
                                                      </label>
                                                    </div>
                                                  </>
                                                ) : null}

                                                {block.type === "richText" ? (
                                                  <>
                                                    <label className="grid gap-1 text-sm">
                                                      <span className="text-[rgb(var(--lp-muted))]">Heading</span>
                                                      <input
                                                        value={block.heading || ""}
                                                        onChange={(e) => {
                                                          const value = e.target.value;
                                                          setBlockById(block.id, (current) =>
                                                            current.type === "richText" ? { ...current, heading: value } : current
                                                          );
                                                        }}
                                                        className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                                      />
                                                    </label>
                                                    <label className="grid gap-1 text-sm">
                                                      <span className="text-[rgb(var(--lp-muted))]">Body</span>
                                                      <textarea
                                                        value={block.body}
                                                        onChange={(e) => {
                                                          const value = e.target.value;
                                                          setBlockById(block.id, (current) =>
                                                            current.type === "richText" ? { ...current, body: value } : current
                                                          );
                                                        }}
                                                        className="min-h-32 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
                                                      />
                                                    </label>
                                                  </>
                                                ) : null}

                                                {block.type === "image" ? (
                                                  <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">
                                                    Image block editor kommer i neste patch.
                                                  </div>
                                                ) : null}

                                                {block.type === "cta" ? (
                                                  <>
                                                    <label className="grid gap-1 text-sm">
                                                      <span className="text-[rgb(var(--lp-muted))]">Title</span>
                                                      <input
                                                        value={block.title}
                                                        onChange={(e) => {
                                                          const value = e.target.value;
                                                          setBlockById(block.id, (current) =>
                                                            current.type === "cta" ? { ...current, title: value } : current
                                                          );
                                                        }}
                                                        className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                                      />
                                                    </label>
                                                    <label className="grid gap-1 text-sm">
                                                      <span className="text-[rgb(var(--lp-muted))]">Body</span>
                                                      <textarea
                                                        value={block.body || ""}
                                                        onChange={(e) => {
                                                          const value = e.target.value;
                                                          setBlockById(block.id, (current) =>
                                                            current.type === "cta" ? { ...current, body: value } : current
                                                          );
                                                        }}
                                                        className="min-h-24 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
                                                      />
                                                    </label>
                                                    <div className="grid gap-2 md:grid-cols-2">
                                                      <label className="grid gap-1 text-sm">
                                                        <span className="text-[rgb(var(--lp-muted))]">Button label</span>
                                                        <input
                                                          value={block.buttonLabel || ""}
                                                          onChange={(e) => {
                                                            const value = e.target.value;
                                                            setBlockById(block.id, (current) =>
                                                              current.type === "cta" ? { ...current, buttonLabel: value } : current
                                                            );
                                                          }}
                                                          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                                        />
                                                      </label>
                                                      <label className="grid gap-1 text-sm">
                                                        <span className="text-[rgb(var(--lp-muted))]">Button href</span>
                                                        <input
                                                          value={block.buttonHref || ""}
                                                          onChange={(e) => {
                                                            const value = e.target.value;
                                                            setBlockById(block.id, (current) =>
                                                              current.type === "cta" ? { ...current, buttonHref: value } : current
                                                            );
                                                          }}
                                                          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                                        />
                                                      </label>
                                                    </div>
                                                  </>
                                                ) : null}

                                                {block.type === "divider" ? (
                                                  <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">
                                                    Divider has no fields.
                                                  </div>
                                                ) : null}

                                                {block.type === "banners" ? (
                                                  <div className="grid gap-4 md:grid-cols-[1fr_360px]">
                                                    <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-4">
                                                      <p className="mb-2 text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">Forhåndsvisning</p>
                                                      <div className="space-y-3">
                                                        {block.items.length === 0 ? (
                                                          <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen bannere ennå. Legg til et banner til høyre.</p>
                                                        ) : (
                                                          block.items.map((item) => (
                                                            <div key={item.id} className="rounded-lg border border-[rgb(var(--lp-border))] bg-white">
                                                              {item.imageUrl ? (
                                                                <img src={item.imageUrl} alt="" className="h-32 w-full object-cover" />
                                                              ) : (
                                                                <div className="flex h-32 w-full items-center justify-center bg-slate-100 text-sm text-[rgb(var(--lp-muted))]">Bilde / video</div>
                                                              )}
                                                              <div className="p-2">
                                                                <p className="truncate text-sm font-medium text-[rgb(var(--lp-text))]">{item.heading || "—"}</p>
                                                                <p className="truncate text-xs text-[rgb(var(--lp-muted))]">{item.secondaryHeading || ""}</p>
                                                              </div>
                                                            </div>
                                                          ))
                                                        )}
                                                      </div>
                                                    </div>
                                                    <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
                                                      <div className="flex items-center justify-between gap-2">
                                                        <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Banner</h3>
                                                        <div className="flex rounded-lg border border-[rgb(var(--lp-border))] p-0.5">
                                                          <button type="button" onClick={() => setBannerPanelTab("content")} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${bannerPanelTab === "content" ? "bg-white text-[rgb(var(--lp-text))] shadow-sm" : "text-[rgb(var(--lp-muted))]"}`} title="Content">
                                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                            Content
                                                          </button>
                                                          <button type="button" onClick={() => setBannerPanelTab("settings")} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${bannerPanelTab === "settings" ? "bg-white text-[rgb(var(--lp-text))] shadow-sm" : "text-[rgb(var(--lp-muted))]"}`} title="Settings">
                                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                            Settings
                                                          </button>
                                                        </div>
                                                      </div>
                                                      {bannerPanelTab === "content" ? (
                                                        <>
                                                          <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Legg til bannere med bilde/video fra mediearkiv.</p>
                                                          <div className="mt-3 space-y-2">
                                                            {block.items.map((item) => (
                                                              <button
                                                                key={item.id}
                                                                type="button"
                                                                onClick={() => setSelectedBannerItemId(selectedBannerItemId === item.id ? null : item.id)}
                                                                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${selectedBannerItemId === item.id ? "border-slate-300 bg-slate-50" : "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]"}`}
                                                              >
                                                                <span className="truncate flex-1">{item.heading || "Banner"}</span>
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: c.items.filter((i) => i.id !== item.id) } : c); setSelectedBannerItemId(null); }} className="text-red-600 hover:underline">Slett</button>
                                                              </button>
                                                            ))}
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                const id = makeBlockId();
                                                                setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: [...c.items, { id, heading: "", secondaryHeading: "", text: "", buttons: [] }] } : c);
                                                                setSelectedBannerItemId(id);
                                                              }}
                                                              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] py-3 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                                                            >
                                                              + Add Banner
                                                            </button>
                                                          </div>
                                                          {selectedBannerItemId && (() => {
                                                            const item = block.items.find((i) => i.id === selectedBannerItemId);
                                                            if (!item) return null;
                                                            return (
                                                              <div className="mt-4 space-y-3 border-t border-[rgb(var(--lp-border))] pt-4">
                                                                <p className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Rediger banner</p>
                                                                <div>
                                                                  <p className="text-xs text-[rgb(var(--lp-muted))]">Bilde · Fokuspunkt defineres i Media.</p>
                                                                  <button type="button" onClick={() => { setMediaPickerTarget({ blockId: block.id, itemId: item.id, field: "imageUrl" }); setMediaPickerOpen(true); }} className="mt-1 flex h-20 w-full items-center justify-center rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-sm text-[rgb(var(--lp-muted))] hover:border-slate-300">
                                                                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover rounded-lg" /> : "Velg fra mediearkiv"}
                                                                  </button>
                                                                </div>
                                                                <div>
                                                                  <p className="text-xs text-[rgb(var(--lp-muted))]">Video (Youtube, Vimeo, MP4)</p>
                                                                  <div className="mt-1 flex gap-2">
                                                                    {(["youtube", "vimeo", "mp4"] as const).map((src) => (
                                                                      <button key={src} type="button" onClick={() => setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: c.items.map((i) => i.id === item.id ? { ...i, videoSource: src } : i) } : c)} className={`rounded px-2 py-1 text-xs font-medium ${item.videoSource === src ? "bg-slate-200 text-slate-900" : "bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-muted))]"}`}>{src.toUpperCase()}</button>
                                                                    ))}
                                                                  </div>
                                                                  <div className="mt-1 flex gap-2">
                                                                    <input type="url" placeholder="URL til video" value={item.videoUrl || ""} onChange={(e) => setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: c.items.map((i) => i.id === item.id ? { ...i, videoUrl: e.target.value } : i) } : c)} className="h-9 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm" />
                                                                    <button type="button" onClick={() => { setMediaPickerTarget({ blockId: block.id, itemId: item.id, field: "videoUrl" }); setMediaPickerOpen(true); }} className="shrink-0 rounded-lg border border-[rgb(var(--lp-border))] px-2 py-1.5 text-xs">Fra mediearkiv</button>
                                                                  </div>
                                                                </div>
                                                                <label className="block">
                                                                  <span className="text-xs text-[rgb(var(--lp-muted))]">Heading</span>
                                                                  <input value={item.heading || ""} onChange={(e) => setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: c.items.map((i) => i.id === item.id ? { ...i, heading: e.target.value } : i) } : c)} className="mt-1 h-9 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm" placeholder="Heading goes here" />
                                                                </label>
                                                                <label className="block">
                                                                  <span className="text-xs text-[rgb(var(--lp-muted))]">Secondary heading</span>
                                                                  <input value={item.secondaryHeading || ""} onChange={(e) => setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: c.items.map((i) => i.id === item.id ? { ...i, secondaryHeading: e.target.value } : i) } : c)} className="mt-1 h-9 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm" placeholder="Heading goes here" />
                                                                </label>
                                                                <label className="block">
                                                                  <span className="text-xs text-[rgb(var(--lp-muted))]">Text</span>
                                                                  <textarea value={item.text || ""} onChange={(e) => setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: c.items.map((i) => i.id === item.id ? { ...i, text: e.target.value } : i) } : c)} rows={3} className="mt-1 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 py-1 text-sm" />
                                                                </label>
                                                                <div>
                                                                  <span className="text-xs text-[rgb(var(--lp-muted))]">Buttons</span>
                                                                  <div className="mt-1 space-y-2">
                                                                    {(item.buttons || []).map((btn, idx) => (
                                                                      <div key={idx} className="flex gap-2">
                                                                        <input value={btn.label} onChange={(e) => setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: c.items.map((i) => i.id === item.id ? { ...i, buttons: (i.buttons || []).map((b, j) => j === idx ? { ...b, label: e.target.value } : b) } : i) } : c)} className="h-9 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm" placeholder="Label" />
                                                                        <input value={btn.href} onChange={(e) => setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: c.items.map((i) => i.id === item.id ? { ...i, buttons: (i.buttons || []).map((b, j) => j === idx ? { ...b, href: e.target.value } : b) } : i) } : c)} className="h-9 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm" placeholder="URL" />
                                                                        <button type="button" onClick={() => setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: c.items.map((i) => i.id === item.id ? { ...i, buttons: (i.buttons || []).filter((_, j) => j !== idx) } : i) } : c)} className="text-red-600 text-xs">Fjern</button>
                                                                      </div>
                                                                    ))}
                                                                    <button type="button" onClick={() => setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: c.items.map((i) => i.id === item.id ? { ...i, buttons: [...(i.buttons || []), { label: "", href: "" }] } : i) } : c)} className="rounded-lg border border-dashed border-[rgb(var(--lp-border))] px-3 py-1.5 text-xs">Add</button>
                                                                  </div>
                                                                </div>
                                                              </div>
                                                            );
                                                          })()}
                                                        </>
                                                      ) : (
                                                        <div className="mt-3">
                                                          {!selectedBannerItemId ? (
                                                            <p className="text-sm text-[rgb(var(--lp-muted))]">Velg et banner i listen for å redigere innstillinger.</p>
                                                          ) : (() => {
                                                            const item = block.items.find((i) => i.id === selectedBannerItemId);
                                                            if (!item) return null;
                                                            const update = (patch: Partial<BannerItem>) => setBlockById(block.id, (c) => c.type === "banners" ? { ...c, items: c.items.map((i) => i.id === item.id ? { ...i, ...patch } : i) } : c);
                                                            return (
                                                              <>
                                                                <div className="flex gap-1 border-b border-[rgb(var(--lp-border))]">
                                                                  {(["layout", "animation", "advanced"] as const).map((tab) => (
                                                                    <button key={tab} type="button" onClick={() => setBannerSettingsSubTab(tab)} className={`px-3 py-2 text-xs font-medium capitalize ${bannerSettingsSubTab === tab ? "border-b-2 border-slate-600 text-slate-900" : "text-[rgb(var(--lp-muted))]"}`}>{tab === "layout" ? "Layout" : tab === "animation" ? "Animation" : "Advanced"}</button>
                                                                  ))}
                                                                </div>
                                                                {bannerSettingsSubTab === "layout" ? (
                                                                  <div className="space-y-4 pt-3">
                                                                    <div>
                                                                      <p className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Banner style</p>
                                                                      <div className="mt-2 grid grid-cols-4 gap-2">
                                                                        {(["takeover", "medium", "short", "scale"] as const).map((style) => (
                                                                          <button key={style} type="button" onClick={() => update({ bannerStyle: style })} className={`rounded-lg border p-2 text-center text-xs font-medium ${item.bannerStyle === style ? "border-slate-400 bg-slate-100 text-slate-900" : "border-[rgb(var(--lp-border))]"}`}>{style.toUpperCase()}</button>
                                                                        ))}
                                                                      </div>
                                                                    </div>
                                                                    <div>
                                                                      <p className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Background color</p>
                                                                      <div className="mt-1 flex gap-2">
                                                                        <input type="text" placeholder="Farge" value={item.backgroundColor || ""} onChange={(e) => update({ backgroundColor: e.target.value })} className="h-9 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm" />
                                                                        <input type="color" value={item.backgroundColor && /^#[0-9A-Fa-f]{6}$/.test(item.backgroundColor) ? item.backgroundColor : "#fbbf24"} onChange={(e) => update({ backgroundColor: e.target.value })} className="h-9 w-10 cursor-pointer rounded border border-[rgb(var(--lp-border))]" />
                                                                      </div>
                                                                      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Secondary heading / body text color</p>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                      <span className="text-xs font-medium text-[rgb(var(--lp-text))]">Scroll prompt</span>
                                                                      <button type="button" onClick={() => update({ scrollPrompt: !item.scrollPrompt })} className={`relative h-6 w-11 rounded-full border transition ${item.scrollPrompt ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${item.scrollPrompt ? "left-5" : "left-0.5"}`} /></button>
                                                                      <span className="text-xs text-[rgb(var(--lp-muted))]">{item.scrollPrompt ? "YES" : "NO"}</span>
                                                                    </div>
                                                                    <div>
                                                                      <p className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Text alignment</p>
                                                                      <div className="mt-1 flex gap-2">
                                                                        {(["left", "center", "right"] as const).map((align) => (
                                                                          <button key={align} type="button" onClick={() => update({ textAlignment: align })} className={`rounded px-2 py-1 text-xs font-medium ${item.textAlignment === align ? "bg-slate-200 text-slate-900" : "bg-[rgb(var(--lp-card))]"}`}>{align.toUpperCase()}</button>
                                                                        ))}
                                                                      </div>
                                                                    </div>
                                                                    <div>
                                                                      <p className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Text position</p>
                                                                      <div className="mt-1 grid grid-cols-3 gap-1">
                                                                        {["top-left", "top-center", "top-right", "middle-left", "center", "middle-right", "bottom-left", "bottom-center", "bottom-right"].map((pos) => (
                                                                          <button key={pos} type="button" onClick={() => update({ textPosition: pos })} className={`rounded border p-1.5 text-[10px] ${item.textPosition === pos ? "border-slate-400 bg-slate-100" : "border-[rgb(var(--lp-border))]"}`}>{pos.replace("-", " ")}</button>
                                                                        ))}
                                                                      </div>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                      <span className="text-xs font-medium text-[rgb(var(--lp-text))]">Apply image opacity</span>
                                                                      <button type="button" onClick={() => update({ imageOpacity: !item.imageOpacity })} className={`relative h-6 w-11 rounded-full border transition ${item.imageOpacity ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${item.imageOpacity ? "left-5" : "left-0.5"}`} /></button>
                                                                      <span className="text-xs text-[rgb(var(--lp-muted))]">{item.imageOpacity ? "YES" : "NO"}</span>
                                                                    </div>
                                                                  </div>
                                                                ) : bannerSettingsSubTab === "animation" ? (
                                                                  <div className="pt-3">
                                                                    <div className="flex items-center justify-between">
                                                                      <span className="text-xs font-medium text-[rgb(var(--lp-text))]">Animate</span>
                                                                      <button type="button" onClick={() => update({ animate: !item.animate })} className={`relative h-6 w-11 rounded-full border transition ${item.animate ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${item.animate ? "left-5" : "left-0.5"}`} /></button>
                                                                      <span className="text-xs text-[rgb(var(--lp-muted))]">{item.animate ? "YES" : "NO"}</span>
                                                                    </div>
                                                                  </div>
                                                                ) : (
                                                                  <div className="space-y-4 pt-3">
                                                                    <label className="block">
                                                                      <span className="text-xs font-semibold text-[rgb(var(--lp-text))]">Name</span>
                                                                      <input value={item.name || ""} onChange={(e) => update({ name: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm" />
                                                                    </label>
                                                                    <label className="block">
                                                                      <span className="text-xs font-semibold text-[rgb(var(--lp-text))]">Anchor name</span>
                                                                      <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">Unik anker som kan brukes for å lenke til denne komponenten. Mellomrom blir til &#39;-&#39;.</p>
                                                                      <input value={item.anchorName || ""} onChange={(e) => update({ anchorName: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm" placeholder="anker-navn" />
                                                                    </label>
                                                                    <label className="block">
                                                                      <span className="text-xs font-semibold text-[rgb(var(--lp-text))]">Custom classes</span>
                                                                      <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">Egne CSS-klasser. Mellomrom mellom hver, f.eks. min-klasse annen-klasse</p>
                                                                      <input value={item.customClasses || ""} onChange={(e) => update({ customClasses: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm" placeholder="klasse1 klasse2" />
                                                                    </label>
                                                                    <div className="flex items-center justify-between">
                                                                      <span className="text-xs font-medium text-[rgb(var(--lp-text))]">Hide from website</span>
                                                                      <button type="button" onClick={() => update({ hideFromWebsite: !item.hideFromWebsite })} className={`relative h-6 w-11 rounded-full border transition ${item.hideFromWebsite ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${item.hideFromWebsite ? "left-5" : "left-0.5"}`} /></button>
                                                                      <span className="text-xs text-[rgb(var(--lp-muted))]">{item.hideFromWebsite ? "YES" : "NO"}</span>
                                                                    </div>
                                                                  </div>
                                                                )}
                                                              </>
                                                            );
                                                          })()}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                ) : null}

                                                {block.type === "code" ? (
                                                  <div className="space-y-3">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                      <span className="text-sm font-medium text-[rgb(var(--lp-text))]">Code</span>
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          const html = block.code?.trim() || "";
                                                          const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
                                                          const w = typeof window !== "undefined" ? window.open("", "_blank", "noopener,width=900,height=700") : null;
                                                          if (w) {
                                                            w.document.write(doc);
                                                            w.document.close();
                                                          }
                                                        }}
                                                        className="rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50"
                                                      >
                                                        Å forhåndsvisning i nytt vindu
                                                      </button>
                                                    </div>
                                                    <div className="flex gap-1 border-b border-[rgb(var(--lp-border))]">
                                                      <span className="border-b-2 border-slate-600 px-3 py-2 text-xs font-medium text-slate-900">Code</span>
                                                      <span className="px-3 py-2 text-xs text-[rgb(var(--lp-muted))]">Content</span>
                                                      <span className="px-3 py-2 text-xs text-[rgb(var(--lp-muted))]">Settings</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                      <span className="text-xs text-[rgb(var(--lp-muted))]">Display intro</span>
                                                      <button type="button" onClick={() => setBlockById(block.id, (c) => c.type === "code" ? { ...c, displayIntro: !c.displayIntro } : c)} className={`relative h-6 w-11 rounded-full border transition ${block.displayIntro ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${block.displayIntro ? "left-5" : "left-0.5"}`} /></button>
                                                      <span className="text-xs text-[rgb(var(--lp-muted))]">{block.displayIntro ? "YES" : "NO"}</span>
                                                    </div>
                                                    <label className="block">
                                                      <span className="text-xs text-[rgb(var(--lp-muted))]">Enter your raw code here. This can be JavaScript, HTML etc.</span>
                                                      <textarea value={block.code} onChange={(e) => setBlockById(block.id, (c) => c.type === "code" ? { ...c, code: e.target.value } : c)} rows={12} className="mt-1 w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white p-2 font-mono text-xs" placeholder="<div>...</div>" />
                                                    </label>
                                                    <div className="flex gap-2">
                                                      <button type="button" className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-1.5 text-xs font-medium">RUN CODE</button>
                                                      <button type="button" className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-1.5 text-xs font-medium">DISPLAY CODE</button>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                      <span className="text-xs text-[rgb(var(--lp-muted))]">Display outro</span>
                                                      <button type="button" onClick={() => setBlockById(block.id, (c) => c.type === "code" ? { ...c, displayOutro: !c.displayOutro } : c)} className={`relative h-6 w-11 rounded-full border transition ${block.displayOutro ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${block.displayOutro ? "left-5" : "left-0.5"}`} /></button>
                                                      <span className="text-xs text-[rgb(var(--lp-muted))]">{block.displayOutro ? "YES" : "NO"}</span>
                                                    </div>
                                                  </div>
                                                ) : null}
                                              </div>
                                            </div>
                                          ) : null}
                                        </article>
                                      );
                                    })
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      addInsertIndexRef.current = blocks.length;
                                      setBlockPickerOpen(true);
                                    }}
                                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[rgb(var(--lp-border))] bg-white py-2.5 text-sm font-medium text-[rgb(var(--lp-text))] hover:border-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))]/30"
                                  >
                                    <span className="text-lg leading-none">+</span>
                                    Legg til innhold
                                  </button>
                                </div>
                              )}
                            </div>
                          </section>
                        </div>

                        {showPreview && (
                          <div className="mt-4 rounded-lg border-t border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/60 py-2 pl-3 pr-2 lg:mt-0 lg:border-t-0 lg:border-l">
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Forhåndsvisning</h3>
                            <LivePreviewPanel pageTitle={title} blocks={blocks} pageId={effectiveId ?? undefined} variantId={undefined} />
                          </div>
                        )}

                        {(bodyMode === "legacy" || bodyMode === "invalid") && (
                          <aside className="lg:sticky lg:top-4 flex h-fit items-center rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-4" aria-label="Forhåndsvisning">
                            <p className="text-sm text-[rgb(var(--lp-muted))]">{bodyMode === "legacy" ? "Konverter til blokker for å se live forhåndsvisning." : "Ugyldig body. Bruk  ««Reset to blocks «» for å se forhåndsvisning."}</p>
                          </aside>
                        )}
                      </div>
                    )}

                    {activeTab === "ekstra" ? (
                      <div className="space-y-4 rounded-b-2xl rounded-t-lg border border-t-0 border-[rgb(var(--lp-border))] bg-white p-4">
                        <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Komponenter</h3>
                        <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul globale toppkomponenter</p>
                            <p className="text-xs text-[rgb(var(--lp-muted))]">Skjul komponenter som er satt globalt øverst på siden.</p>
                          </div>
                          <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                            <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                          </button>
                          <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Over hovedinnhold</p>
                          <p className="text-xs text-[rgb(var(--lp-muted))]">Plassert over hovedinnholdet og spenner full bredde av siden.</p>
                          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3">
                            <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f] font-mono text-xs text-white">&lt;/&gt;</span>
                              <div>
                                <p className="font-medium text-[rgb(var(--lp-text))]">Code</p>
                                <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">COMPONENT: CODE</p>
                              </div>
                            </div>
                            <button type="button" className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-white py-3 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]">
                              <span className="text-lg leading-none">+</span> Legg til innhold
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Under hovedinnhold</p>
                          <p className="text-xs text-[rgb(var(--lp-muted))]">Plassert under hovedinnholdet og spenner full bredde av siden.</p>
                          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3">
                            <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f] font-mono text-xs text-white">&lt;/&gt;</span>
                              <div>
                                <p className="font-medium text-[rgb(var(--lp-text))]">Code</p>
                                <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">COMPONENT: CODE</p>
                              </div>
                            </div>
                            <button type="button" className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-white py-3 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]">
                              <span className="text-lg leading-none">+</span> Legg til innhold
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul globale bunnkomponenter</p>
                            <p className="text-xs text-[rgb(var(--lp-muted))]">Skjul komponenter som er satt globalt nederst på siden.</p>
                          </div>
                          <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                            <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                          </button>
                          <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
                        </div>
                        <h3 className="pt-4 text-sm font-semibold text-[rgb(var(--lp-text))]">Pods</h3>
                        <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul globale pods</p>
                            <p className="text-xs text-[rgb(var(--lp-muted))]">Skjul pods som er satt globalt.</p>
                          </div>
                          <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                            <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                          </button>
                          <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
                        </div>
                        <button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] py-3 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]">
                          <span className="text-lg leading-none">+</span> Legg til innhold
                        </button>
                        <h3 className="pt-4 text-sm font-semibold text-[rgb(var(--lp-text))]">Modaler</h3>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">Modaler knyttet til denne siden. Kommer snart.</p>
                      </div>
                    ) : null}

                    {activeTab === "oppsummering" ? (
                      <div className="space-y-4 rounded-b-2xl rounded-t-lg border border-t-0 border-[rgb(var(--lp-border))] bg-white p-4">
                        <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Oppsummering</h3>
                        <div className="rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">
                          Dette innholdet vises kun på  ««Listing «»- eller  ««Related Content «»-pod.
                        </div>
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium text-[rgb(var(--lp-text))]">Overskrift</span>
                          <p className="text-xs text-[rgb(var(--lp-muted))]">Sidenavn brukes som standard hvis ingenting er fylt inn.</p>
                          <input
                            value={safeStr((meta as { summaryHeading?: unknown }).summaryHeading) || title}
                            onChange={(e) => setMeta((prev) => ({ ...prev, summaryHeading: e.target.value }))}
                            className="mt-1 h-11 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
                            placeholder={title || "Overskrift for listing"}
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium text-[rgb(var(--lp-text))]">–</span>
                          <input
                            value={safeStr((meta as { summarySecondaryHeading?: unknown }).summarySecondaryHeading)}
                            onChange={(e) => setMeta((prev) => ({ ...prev, summarySecondaryHeading: e.target.value }))}
                            className="mt-1 h-11 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
                            placeholder="Valgfri underoverskrift"
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium text-[rgb(var(--lp-text))]">Tekst</span>
                          <textarea
                            value={safeStr((meta as { summary?: unknown }).summary)}
                            onChange={(e) => setMeta((prev) => ({ ...prev, summary: e.target.value }))}
                            rows={6}
                            className="mt-1 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
                            placeholder="Rich tekst for listing og relatert innhold."
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium text-[rgb(var(--lp-text))]">Bilde</span>
                          <p className="text-xs text-[rgb(var(--lp-muted))]">Fokuspunkt defineres i Media-seksjonen.</p>
                          <div className="mt-2 flex h-24 w-32 items-center justify-center rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-muted))]">
                            <span className="text-xs">Last opp / erstatt</span>
                          </div>
                        </label>
                      </div>
                    ) : null}

                    {activeTab === "navigasjon" ? (
                      <div className="space-y-4 rounded-b-2xl rounded-t-lg border border-t-0 border-[rgb(var(--lp-border))] bg-white p-4">
                        <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Navigasjon</h3>
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-4 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul fra all navigasjon</p>
                              <p className="text-xs text-[rgb(var(--lp-muted))]">Velg  ««Ja «» for å skjule denne siden fra all auto-generert navigasjon, manuelt lagt til navigasjon, knapper og lister.</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button type="button" role="switch" aria-checked={!(meta as { nav?: { show?: boolean } }).nav?.show !== false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200" onClick={() => setMeta((prev) => ({ ...prev, nav: { ...safeObj((prev as { nav?: unknown }).nav), show: (meta as { nav?: { show?: boolean } }).nav?.show === false } }))}>
                                <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                              </button>
                              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
                            </div>
                          </div>
                          <div className="flex items-start justify-between gap-4 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul fra intern søk</p>
                              <p className="text-xs text-[rgb(var(--lp-muted))]">Velg  ««Ja «» for å skjule denne siden fra nettstedets interne søk.</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                                <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                              </button>
                              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
                            </div>
                          </div>
                          <div className="flex items-start justify-between gap-4 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul brødsmule</p>
                              <p className="text-xs text-[rgb(var(--lp-muted))]">Velg  ««Ja «» for å skjule den auto-genererte brødsmulenavigasjonen fra denne siden.</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                                <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                              </button>
                              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
                            </div>
                          </div>
                        </div>
                        <p className="pt-2 text-sm font-medium text-[rgb(var(--lp-text))]">Lenketekster</p>
                        <p className="text-xs text-[rgb(var(--lp-muted))]">Sidenavn brukes som standard hvis ingenting er fylt inn.</p>
                        <div className="grid gap-3 pt-2">
                          {(
                            [
                              ["subNavLinkText", "Subnavigasjon lenketekst"],
                              ["sitemapLinkText", "HTML sitemap lenketekst"],
                              ["breadcrumbLinkText", "Brødsmule lenketekst"],
                              ["searchResultsLinkText", "Søkeresultat lenketekst"],
                            ] as const
                          ).map((entry) => {
                            const [navKey, navLabel] = entry;
                            return (
                              <label key={navKey} className="grid gap-1 text-sm">
                                <span className="font-medium text-[rgb(var(--lp-text))]">{navLabel}</span>
                                <input
                                  value={safeStr((meta as { nav?: Record<string, unknown> }).nav?.[navKey]) || (navKey === "breadcrumbLinkText" ? title : "")}
                                  onChange={(e) => setMeta((prev) => ({ ...prev, nav: { ...safeObj((prev as { nav?: unknown }).nav), [navKey]: e.target.value } }))}
                                  className="h-11 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
                                  placeholder={title || "Lenketekst"}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {activeTab === "seo" ? (
                      <div className="space-y-4 rounded-b-2xl rounded-t-lg border border-t-0 border-[rgb(var(--lp-border))] bg-white p-4">
                        <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">SEO &amp; deling</h3>

                        {(() => {
                          const root = safeObj(meta);
                          const rawSeo = safeObj((root as { seo?: unknown }).seo);
                          const seoTitle = safeStr(rawSeo.title) || title;
                          const seoDescription = safeStr(rawSeo.description);
                          const canonicalUrl = safeStr(rawSeo.canonicalUrl);
                          const noIndex = rawSeo.noIndex === true;
                          const noFollow = rawSeo.noFollow === true;
                          const ogImage = safeStr(rawSeo.ogImage);
                          const twitterCreator = safeStr(rawSeo.twitterCreator);
                          const sitemapPriority = Number((rawSeo as { sitemapPriority?: unknown }).sitemapPriority) || 0;
                          const sitemapChangeFreq = safeStr((rawSeo as { sitemapChangeFreq?: unknown }).sitemapChangeFreq) || "";
                          const alternativeUrl = safeStr((rawSeo as { alternativeUrl?: unknown }).alternativeUrl);
                          const alternativeName = safeStr((rawSeo as { alternativeName?: unknown }).alternativeName);
                          const titleLen = seoTitle.length;
                          const descLen = seoDescription.length;

                          return (
                            <>
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Tittel og beskrivelse</p>
                                <p className="text-xs text-[rgb(var(--lp-muted))]">Slik kan siden vises i søkeresultat.</p>
                                <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-slate-50 p-3 text-sm">
                                  <p className="truncate text-xs text-[rgb(var(--lp-muted))]">{slug ? `${slug}/` : "..."}</p>
                                  <p className="mt-1 font-medium text-blue-600">{seoTitle || "Sidetittel"}</p>
                                  <p className="mt-0.5 line-clamp-2 text-[13px] text-[rgb(var(--lp-muted))]">{seoDescription || "Meta-beskrivelse"}</p>
                                </div>
                              </div>

                              <label className="grid gap-1 text-sm">
                                <span className="text-[rgb(var(--lp-muted))]">SEO-tittel</span>
                                <input
                                  value={seoTitle}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setMeta((prev) => {
                                      const nextRoot = safeObj(prev);
                                      const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
                                      return { ...nextRoot, seo: { ...nextSeo, title: value } };
                                    });
                                  }}
                                  className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                  placeholder={title || "Tittel for søkeresultat"}
                                />
                                <span className={titleLen >= 50 && titleLen <= 60 ? "text-xs text-green-600" : "text-xs text-[rgb(var(--lp-muted))]"}>
                                  {titleLen} tegn — anbefalt 50–60
                                </span>
                              </label>

                              <label className="grid gap-1 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[rgb(var(--lp-muted))]">Meta-beskrivelse</span>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
                                    disabled={isOffline || !effectiveId || aiBusyToolId === "seo.optimize.page"}
                                    onClick={() =>
                                      handleAiSeoOptimize?.(
                                        { goal: "lead", audience: "" },
                                        { fromInline: true }
                                      )
                                    }
                                  >
                                    {aiBusyToolId === "seo.optimize.page" ? "Kjører…" : "Generer SEO-forslag"}
                                  </button>
                                </div>
                                <textarea
                                  value={seoDescription}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setMeta((prev) => {
                                      const nextRoot = safeObj(prev);
                                      const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
                                      return { ...nextRoot, seo: { ...nextSeo, description: value } };
                                    });
                                  }}
                                  className="min-h-20 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
                                  placeholder="Kort og tydelig oppsummering for søkemotorer."
                                />
                                <span className={descLen >= 155 && descLen <= 160 ? "text-xs text-green-600" : "text-xs text-[rgb(var(--lp-muted))]"}>
                                  {descLen} tegn — anbefalt 155–160
                                </span>
                              </label>

                              <div className="space-y-1">
                                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Delingsbilde</p>
                                <p className="text-xs text-[rgb(var(--lp-muted))]">Bilde som brukes når siden deles på sosiale medier. Bruk minst 1200×630 px. Hvis tomt brukes standard fra Global &gt; Innhold og innstillinger.</p>
                                <input
                                  value={ogImage}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setMeta((prev) => {
                                      const nextRoot = safeObj(prev);
                                      const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
                                      return { ...nextRoot, seo: { ...nextSeo, ogImage: value } };
                                    });
                                  }}
                                  className="h-10 w-full rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                  placeholder="/images/..."
                                />
                              </div>

                              <label className="grid gap-1 text-sm">
                                <span className="text-[rgb(var(--lp-muted))]">Twitter-brukernavn (creator)</span>
                                <input
                                  value={twitterCreator}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setMeta((prev) => {
                                      const nextRoot = safeObj(prev);
                                      const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
                                      return { ...nextRoot, seo: { ...nextSeo, twitterCreator: value } };
                                    });
                                  }}
                                  className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                                  placeholder="@brukernavn"
                                />
                              </label>

                              <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul fra søkemotorer</p>
                                  <p className="text-xs text-[rgb(var(--lp-muted))]">Legger til noindex og ekskluderer siden fra sitemap.xml.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button type="button" role="switch" aria-checked={noIndex} onClick={() => setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, noIndex: !s.noIndex } }; })} className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${noIndex ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"}`}>
                                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${noIndex ? "translate-x-5" : "translate-x-0.5"}`} />
                                  </button>
                                  <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{noIndex ? "JA" : "NEI"}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Stopp at søkemotorer følger lenker</p>
                                  <p className="text-xs text-[rgb(var(--lp-muted))]">Legger til nofollow slik at lenker på siden ikke følges.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button type="button" role="switch" aria-checked={noFollow} onClick={() => setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, noFollow: !s.noFollow } }; })} className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${noFollow ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"}`}>
                                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${noFollow ? "translate-x-5" : "translate-x-0.5"}`} />
                                  </button>
                                  <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{noFollow ? "JA" : "NEI"}</span>
                                </div>
                              </div>

                              <div className="grid gap-2">
                                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Sitemap XML-prioritet</p>
                                <div className="flex items-center gap-3">
                                  <input type="number" min={0} max={1} step={0.1} value={sitemapPriority} onChange={(e) => { const v = Number(e.target.value); setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, sitemapPriority: v } }; }); }} className="h-10 w-20 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm" />
                                  <input type="range" min={0} max={1} step={0.1} value={sitemapPriority} onChange={(e) => { const v = Number(e.target.value); setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, sitemapPriority: v } }; }); }} className="flex-1" />
                                </div>
                              </div>

                              <div className="grid gap-2">
                                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Sitemap XML endringsfrekvens</p>
                                <div className="flex flex-wrap gap-1">
                                  {(["ALWAYS", "HOURLY", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "NEVER"] as const).map((freq) => (
                                    <button key={freq} type="button" onClick={() => setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, sitemapChangeFreq: freq } }; })} className={`rounded border px-2 py-1 text-xs font-medium ${sitemapChangeFreq === freq ? "border-slate-400 bg-slate-100 text-slate-900" : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]"}`}>
                                      {freq}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <label className="grid gap-1 text-sm">
                                <span className="text-[rgb(var(--lp-muted))]">Override canonical URL</span>
                                <p className="text-xs text-[rgb(var(--lp-muted))]">Full URL inkl. scheme, f.eks. https://www.nettsted.no</p>
                                <input value={canonicalUrl} onChange={(e) => { const value = e.target.value; setMeta((prev) => { const nextRoot = safeObj(prev); const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo); return { ...nextRoot, seo: { ...nextSeo, canonicalUrl: value } }; }); }} className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm" placeholder="https://..." />
                              </label>

                              <label className="grid gap-1 text-sm">
                                <span className="text-[rgb(var(--lp-muted))]">Alternativ URL</span>
                                <p className="text-xs text-[rgb(var(--lp-muted))]">Flere URL-er for samme side, kommaseparert, små bokstaver, uten ledende / og uten filending.</p>
                                <input value={alternativeUrl} onChange={(e) => { const value = e.target.value; setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, alternativeUrl: value } }; }); }} className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm" placeholder="eksempel1,eksempel2/sti" />
                              </label>

                              <label className="grid gap-1 text-sm">
                                <span className="text-[rgb(var(--lp-muted))]">Alternativt navn</span>
                                <p className="text-xs text-[rgb(var(--lp-muted))]">Overstyrer standard nodenavn som brukes i URL.</p>
                                <input value={alternativeName} onChange={(e) => { const value = e.target.value; setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, alternativeName: value } }; }); }} className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm" placeholder="" />
                              </label>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}

                    {activeTab === "scripts" ? (
                      <div className="space-y-6 rounded-b-2xl rounded-t-lg border border-t-0 border-[rgb(var(--lp-border))] bg-white p-4">
                        <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Scripts</h3>

                        {(() => {
                          const root = safeObj(meta);
                          const rawScripts = safeObj((root as { scripts?: unknown }).scripts);
                          const headScript = String(rawScripts.head ?? "");
                          const bodyScript = String(rawScripts.body ?? "");
                          const disableHeadGlobal = (rawScripts as { disableGlobal?: boolean }).disableGlobal === true;
                          const disableBodyGlobal = (rawScripts as { disableBodyGlobal?: boolean }).disableBodyGlobal === true;
                          return (
                            <>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                                  <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Deaktiver globale scripts (head)</p>
                                  <div className="flex items-center gap-2">
                                    <button type="button" role="switch" aria-checked={disableHeadGlobal} onClick={() => setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { scripts?: unknown }).scripts); return { ...r, scripts: { ...s, disableGlobal: !(s as { disableGlobal?: boolean }).disableGlobal } }; })} className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 ${disableHeadGlobal ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"}`}>
                                      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow ${disableHeadGlobal ? "translate-x-5" : "translate-x-0.5"}`} />
                                    </button>
                                    <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{disableHeadGlobal ? "JA" : "NEI"}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-[rgb(var(--lp-muted))]">Scripts som injiseres etter åpning av &lt;head&gt;. Husk &lt;script&gt;&lt;/script&gt; rundt JavaScript.</p>
                                <label className="grid gap-1 text-sm">
                                  <span className="text-[rgb(var(--lp-muted))]">Scripts</span>
                                  <textarea value={headScript} onChange={(e) => { const v = e.target.value; setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { scripts?: unknown }).scripts); return { ...r, scripts: { ...s, head: v } }; }); }} rows={4} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]" placeholder="<script>...</script>" />
                                </label>
                              </div>

                              <div className="space-y-3 border-t border-[rgb(var(--lp-border))] pt-4">
                                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Scripts før lukking av &lt;/body&gt;</p>
                                <p className="text-xs text-[rgb(var(--lp-muted))]">Disse scriptene plasseres før &lt;/body&gt; på denne siden. Husk &lt;script&gt;&lt;/script&gt; rundt JavaScript.</p>
                                <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                                  <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Deaktiver globale scripts</p>
                                  <div className="flex items-center gap-2">
                                    <button type="button" role="switch" aria-checked={disableBodyGlobal} onClick={() => setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { scripts?: unknown }).scripts); return { ...r, scripts: { ...s, disableBodyGlobal: !(s as { disableBodyGlobal?: boolean }).disableBodyGlobal } }; })} className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 ${disableBodyGlobal ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"}`}>
                                      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow ${disableBodyGlobal ? "translate-x-5" : "translate-x-0.5"}`} />
                                    </button>
                                    <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{disableBodyGlobal ? "JA" : "NEI"}</span>
                                  </div>
                                </div>
                                <label className="grid gap-1 text-sm">
                                  <span className="text-[rgb(var(--lp-muted))]">Scripts</span>
                                  <textarea value={bodyScript} onChange={(e) => { const v = e.target.value; setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { scripts?: unknown }).scripts); return { ...r, scripts: { ...s, body: v } }; }); }} rows={4} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]" placeholder="<script>...</script>" />
                                </label>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}

                    {activeTab === "avansert" ? (
                      <div className="space-y-6 rounded-b-2xl rounded-t-lg border border-t-0 border-[rgb(var(--lp-border))] bg-white p-4">
                        <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Avansert</h3>

                        <div className="grid gap-4">
                          <div>
                            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Override global node</p>
                            <p className="text-xs text-[rgb(var(--lp-muted))]">Velg  ««Global node «» som gjelder for denne siden og alle undersider. Overstyrer valg på foresiden.</p>
                            <button type="button" className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]">
                              Legg til
                            </button>
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul nettstedets header</p>
                              <p className="text-xs text-[rgb(var(--lp-muted))]">Fjern global header-innhold øverst på denne siden.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                                <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                              </button>
                              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul nettstedets footer</p>
                              <p className="text-xs text-[rgb(var(--lp-muted))]">Fjern global footer-innhold nederst på denne siden.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                                <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                              </button>
                              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Override designstil</p>
                            <p className="text-xs text-[rgb(var(--lp-muted))]">Velg designstil for denne siden og alle undersider. Overstyrer valg på foresiden eller i Global &gt; Innstillinger.</p>
                            <button type="button" className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]">
                              Legg til
                            </button>
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Override nettstedets logo</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                                <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                              </button>
                              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Override innholdsretning</p>
                            <p className="text-xs text-[rgb(var(--lp-muted))]">Overstyr standard innholdsretning fra Global &gt; Innhold og innstillinger.</p>
                            <div className="mt-2 flex gap-2">
                              <button type="button" className="rounded-lg border-2 border-slate-400 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800">
                                LTR
                              </button>
                              <button type="button" className="rounded-lg border-2 border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300">
                                RTL
                              </button>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Egendefinerte sidemapper</p>
                            <p className="text-xs text-[rgb(var(--lp-muted))]">Overstyr standardstiler ved å legge til sidemapper. Mellomrom mellom hver klasse, f.eks. min-klasse annen-klasse.</p>
                            <textarea rows={3} className="mt-2 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]" placeholder="custom-class annen-klasse" />
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Deaktiver sletting</p>
                              <p className="text-xs text-[rgb(var(--lp-muted))]">Når  ««Ja «» er valgt vil forsøk på å slette denne noden blokkeres og en advarsel vises.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                                <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                              </button>
                              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
                            </div>
                          </div>
                        </div>

                        <dl className="grid gap-2 border-t border-[rgb(var(--lp-border))] pt-4 text-sm">
                          <div>
                            <dt className="text-[rgb(var(--lp-muted))]">Side-ID</dt>
                            <dd className="font-mono text-[rgb(var(--lp-text))]">{page?.id ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-[rgb(var(--lp-muted))]">Status</dt>
                            <dd>{statusLabel === "published" ? "Publisert" : "Kladd"}</dd>
                          </div>
                          <div>
                            <dt className="text-[rgb(var(--lp-muted))]">Opprettet</dt>
                            <dd>{formatDate(page?.created_at)}</dd>
                          </div>
                          <div>
                            <dt className="text-[rgb(var(--lp-muted))]">Sist oppdatert</dt>
                            <dd>{formatDate(page?.updated_at)}</dd>
                          </div>
                          <div>
                            <dt className="text-[rgb(var(--lp-muted))]">Publisert</dt>
                            <dd>{formatDate(page?.published_at)}</dd>
                          </div>
                        </dl>
                      </div>
                    ) : null}

                    {/* U1 – typography/spacing tightening */}
                    <ContentSaveBar
                      selectedId={selectedId}
                      saving={saving}
                      canSave={canSave}
                      onSaveAndPreview={onSaveAndPreview}
                      onSave={() => void onSave()}
                    />

                    <ContentAiTools
                      disabled={isOffline || !effectiveId || aiCapability !== "available"}
                      aiCapabilityStatus={aiCapability}
                      busyToolId={aiBusyToolId}
                      errorMessage={aiError}
                      lastSummary={aiSummary}
                      lastBlockBuilderResult={aiBlockBuilderResult}
                      lastAppliedTool={aiLastAppliedTool}
                      onImprovePage={handleAiImprovePage}
                      onSeoOptimize={handleAiSeoOptimize}
                      onGenerateSections={handleAiGenerateSections}
                      onStructuredIntent={handleAiStructuredIntent}
                      onLayoutSuggestions={handleLayoutSuggestions}
                      onBlockBuilder={handleBlockBuilder}
                      onImageGenerate={handleAiImageGenerate}
                      onScreenshotBuilder={handleScreenshotBuilder}
                      onImageImproveMetadata={handleAiImageImproveMetadata}
                    />
                  </div>
                  {SHELL_V1 && (
                    <ContentInfoPanel
                      page={page}
                      statusLabel={statusLabel}
                      isForsidePage={isForsidePage}
                      formatDate={formatDate}
                    />
                  )}
                </div>
              )
            ) : selectedId ? (
              <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-white p-4 text-center text-sm text-[rgb(var(--lp-muted))]">
                Laster redigeringsområde…
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <BlockAddModal open={addBlockModalOpen} onClose={() => setAddBlockModalOpen(false)} onAdd={onAddBlock} />
      <BlockPickerOverlay
        open={blockPickerOpen}
        context={{
          pageId: page?.id ?? "unknown",
          isHome:
            (page ? isForside(page.slug, page.title) : isForside(slug, title)) ||
            page?.slug === "home" ||
            page?.id === "home",
          docType: null,
        }}
        onClose={() => {
          setBlockPickerOpen(false);
          addInsertIndexRef.current = null;
        }}
        onPick={(def: BlockDefinition) => {
          const safeType: BlockType = isAddModalBlockTypeFromOverlay(def.type) ? def.type : "richText";
          const next = createBlock(safeType);

          setBodyMode("blocks");
          setBodyParseError(null);
          setLegacyBodyText("");
          setInvalidBodyRaw("");

          setBlocks((prev) => {
            const index = addInsertIndexRef.current;
            if (index == null || index < 0 || index > prev.length) {
              return [...prev, next];
            }
            const copy = [...prev];
            copy.splice(index, 0, next);
            return copy;
          });
          setExpandedBlockId(next.id);
          setBlockPickerOpen(false);
          addInsertIndexRef.current = null;
        }}
      />

      <BlockEditModal
        open={editOpen}
        block={editIndex != null && blocks[editIndex] ? blocks[editIndex] : null}
        blockIndex={editIndex}
        onClose={() => { setEditOpen(false); setEditIndex(null); }}
        onChange={(nextBlock) => {
          if (editIndex == null) return;
          setBlocks((prev) => prev.map((b, i) => (i === editIndex ? (nextBlock as Block) : b)));
        }}
        onDelete={() => {
          if (editIndex == null) return;
          const id = blocks[editIndex]?.id;
          if (id) onDeleteBlock(id);
          setEditOpen(false);
          setEditIndex(null);
        }}
      />

      <MediaPickerModal
        open={mediaPickerOpen && !!mediaPickerTarget}
        title={mediaPickerTarget?.field === "heroImageUrl" || mediaPickerTarget?.field === "imageUrl" ? "Velg bilde fra mediearkiv" : "Velg video fra mediearkiv"}
        onClose={() => { setMediaPickerOpen(false); setMediaPickerTarget(null); }}
        onSelect={(url) => {
          if (!mediaPickerTarget) return;
          if (mediaPickerTarget.field === "heroImageUrl") {
            setBlockById(mediaPickerTarget.blockId, (c) =>
              c.type === "hero" ? { ...c, imageUrl: url } : c
            );
          } else {
            setBlockById(mediaPickerTarget.blockId, (c) => {
              if (c.type !== "banners" || mediaPickerTarget.itemId == null) return c;
              return { ...c, items: c.items.map((i) => i.id === mediaPickerTarget.itemId ? { ...i, [mediaPickerTarget.field]: url } : i) };
            });
          }
          setMediaPickerOpen(false);
          setMediaPickerTarget(null);
        }}
      />
    </>
  );
}
