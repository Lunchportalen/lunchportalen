"use client";

type Layout =
  | "full"
  | "left"
  | "right"
  | "centerNavLeft"
  | "centerNavRight";

type LayoutThumbnailProps = {
  layout: Layout;
};

export function LayoutThumbnail({ layout }: LayoutThumbnailProps) {
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

