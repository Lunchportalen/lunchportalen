"use client";

import {
  ClipboardList,
  GitBranch,
  ImageIcon,
  LayoutGrid,
  Link2,
  MapPin,
  Maximize2,
  Minus,
  MousePointerClick,
  PanelTop,
  Rows,
  Sparkles,
  Tag,
  Type,
} from "lucide-react";
import type { BlockType } from "./editorBlockTypes";

const iconClass = "h-4 w-4 shrink-0 text-[rgb(var(--lp-text))]";

export function BlockTypeIcon({ type, className = "" }: { type: BlockType | string; className?: string }) {
  const t = (type ?? "").trim();
  switch (t) {
    case "hero":
      return <Sparkles className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "hero_full":
      return <PanelTop className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "hero_bleed":
      return <Maximize2 className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "banner":
      return <Rows className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "richText":
      return <Type className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "image":
      return <ImageIcon className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "cta":
      return <MousePointerClick className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "cards":
      return <LayoutGrid className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "zigzag":
      return <GitBranch className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "pricing":
      return <Tag className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "grid":
      return <MapPin className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "form":
      return <ClipboardList className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "relatedLinks":
      return <Link2 className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    case "divider":
      return <Minus className={`${iconClass} ${className}`} aria-hidden strokeWidth={2} />;
    default:
      return <LayoutGrid className={`${iconClass} opacity-50 ${className}`} aria-hidden strokeWidth={2} />;
  }
}
