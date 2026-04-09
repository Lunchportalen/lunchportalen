"use client";

export type SocialPreviewProps = {
  productName: string;
  caption: string;
  hashtags: string[];
  platforms: readonly string[];
};

/**
 * Enkel Instagram-lignende forhåndsvisning — kun visuell, ingen nettverkskall.
 */
export function SocialPreview(props: SocialPreviewProps) {
  const { productName, caption, hashtags, platforms } = props;
  const tagLine = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");

  return (
    <div className="mx-auto max-w-[280px] overflow-clip rounded-xl border border-neutral-800 bg-black text-white shadow-lg">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-amber-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">lunchportalen</div>
          <div className="text-[10px] text-white/60">Sponset innhold · Forhåndsvisning</div>
        </div>
      </div>
      <div className="aspect-square w-full bg-gradient-to-b from-neutral-800 to-neutral-900" aria-hidden>
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white/70">{productName}</div>
      </div>
      <div className="space-y-1 px-3 py-2 text-left">
        <p className="text-[11px] font-medium text-white/90">{platforms.join(" · ")}</p>
        <p className="whitespace-pre-line text-xs leading-relaxed text-white/90">{caption}</p>
        <p className="text-[11px] text-sky-300/90">{tagLine}</p>
      </div>
    </div>
  );
}
