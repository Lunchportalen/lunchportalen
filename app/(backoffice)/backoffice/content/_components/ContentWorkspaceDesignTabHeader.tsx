"use client";

/**
 * Shop Design-fane: H1 + tab-rad (samme markup som tidligere inline).
 */

const DESIGN_TAB_LABELS = [
  "Layout",
  "Logo",
  "Colors",
  "Spacing",
  "Fonts",
  "Backgrounds",
  "CSS",
  "JavaScript",
  "Advanced",
] as const;

export type DesignWorkspaceTab = (typeof DESIGN_TAB_LABELS)[number];

export function ContentWorkspaceDesignTabHeader(props: {
  designTab: DesignWorkspaceTab;
  setDesignTab: (t: DesignWorkspaceTab) => void;
}) {
  const { designTab, setDesignTab } = props;
  return (
    <>
      <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Shop Design</h1>
      <div className="flex flex-wrap gap-1 border-b border-[rgb(var(--lp-border))] pb-2">
        {DESIGN_TAB_LABELS.map((label) => (
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
    </>
  );
}
