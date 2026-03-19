"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AiTreeLeaf = {
  id: string;
  label: string;
  href: string | null;
};

type AiTreeGroup = {
  id: string;
  label: string;
  children: AiTreeLeaf[];
};

const AI_ROOT_LABEL = "AI Command Center";
const AI_ROOT_HREF = "/backoffice/ai";

const AI_TREE_GROUPS: AiTreeGroup[] = [
  {
    id: "control",
    label: "Control",
    children: [
      { id: "overview", label: "Overview", href: "/backoffice/ai" },
      { id: "ai-control", label: "AI Control", href: null },
    ],
  },
  {
    id: "optimization",
    label: "Optimization",
    children: [
      { id: "media-ai", label: "Media AI", href: "/backoffice/media" },
      { id: "seo-cro", label: "SEO / CRO", href: null },
      { id: "experiments", label: "Experiments", href: "/backoffice/experiments" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    children: [
      { id: "insights", label: "Insights", href: "/admin/insights" },
      { id: "health", label: "Health", href: "/backoffice/ai#health" },
      { id: "jobs-runs", label: "Jobs / Runs", href: "/backoffice/ai#jobs" },
    ],
  },
  {
    id: "system",
    label: "System",
    children: [
      { id: "settings", label: "Settings", href: "/backoffice/settings" },
      { id: "ai-config", label: "AI Config", href: null },
    ],
  },
];

type AiTreeNavProps = {
  className?: string;
};

export function AiTreeNav({ className }: AiTreeNavProps) {
  const pathname = usePathname() ?? "";
  const [hash, setHash] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateHash = () => {
      setHash(window.location.hash || "");
    };

    updateHash();
    window.addEventListener("hashchange", updateHash);

    return () => {
      window.removeEventListener("hashchange", updateHash);
    };
  }, []);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    AI_TREE_GROUPS.reduce<Record<string, boolean>>((acc, group) => {
      acc[group.id] = true;
      return acc;
    }, {}),
  );

  const leafIsActive = useMemo(() => {
    return (leaf: AiTreeLeaf) => {
      if (!leaf.href) return false;

      const [hrefPath, hrefHash] = leaf.href.split("#");

      if (hrefHash) {
        const currentHash = (hash || "").replace(/^#/, "");
        return (
          (pathname === hrefPath || pathname.startsWith(`${hrefPath}/`)) &&
          currentHash === hrefHash
        );
      }

      return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
    };
  }, [pathname, hash]);

  const groupIsActive = (group: AiTreeGroup) => group.children.some((leaf) => leafIsActive(leaf));

  const rootIsActive = useMemo(
    () => pathname === "/backoffice/ai" || pathname.startsWith("/backoffice/ai/"),
    [pathname],
  );

  return (
    <nav
      className={["rounded-lg border border-slate-200 bg-white p-4", className].filter(Boolean).join(" ")}
      aria-label="AI Command Center navigasjon"
    >
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
          {AI_ROOT_LABEL}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">Navigasjon for AI-control, innsikt og system.</p>
      </div>

      <div className="space-y-2">
        <RootLink isActive={rootIsActive} />
      </div>

      <div className="mt-4 h-px bg-slate-100" aria-hidden="true" />

      <div className="mt-4 space-y-3">
        {AI_TREE_GROUPS.map((group) => {
          const isGroupActive = groupIsActive(group);
          const isExpanded = expanded[group.id] ?? true;

          return (
            <section key={group.id} className="space-y-1.5">
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [group.id]: !prev[group.id],
                  }))
                }
                className={[
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.14em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                  isGroupActive
                    ? "border-l-2 border-l-slate-900 bg-slate-50 text-slate-900"
                    : "border-l-2 border-l-transparent bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                ].join(" ")}
                aria-expanded={isExpanded}
              >
                <span
                  className={[
                    "inline-flex h-5 w-5 items-center justify-center rounded border text-slate-600 transition-colors",
                    isGroupActive ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-300 bg-white",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <ChevronIcon open={isExpanded} />
                </span>
                <span className="min-w-0 truncate">{group.label}</span>
              </button>

              {isExpanded && (
                <ul className="space-y-1 pl-8" aria-label={group.label}>
                  {group.children.map((leaf) => {
                    const isActive = leafIsActive(leaf);
                    const isRootLeaf = !!leaf.href && leaf.href === AI_ROOT_HREF;
                    const isEffectiveActive = isActive && !isRootLeaf;

                    if (!leaf.href) {
                      return (
                        <li key={leaf.id}>
                          <div className="flex min-h-[36px] items-center gap-2 rounded-md px-2 text-sm text-slate-400">
                            <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
                            <span className="font-medium">{leaf.label}</span>
                            <span className="text-[11px]">kommer</span>
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li key={leaf.id}>
                        <Link
                          href={leaf.href}
                          className={[
                            "flex min-h-[36px] items-center gap-2 rounded-md border-l-2 px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                            isEffectiveActive
                              ? "border-l-slate-900 bg-slate-900 text-slate-50 hover:bg-slate-900"
                              : "border-l-transparent text-slate-800 hover:bg-slate-50 hover:text-slate-950",
                          ].join(" ")}
                          aria-current={isEffectiveActive ? "page" : undefined}
                        >
                          <span
                            className={["h-4 w-px", isEffectiveActive ? "bg-slate-200" : "bg-slate-300"].join(" ")}
                            aria-hidden="true"
                          />
                          <span className={isEffectiveActive ? "font-semibold" : "font-medium"}>{leaf.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </nav>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={["h-3.5 w-3.5 text-current transition-transform", open ? "rotate-90" : "rotate-0"].join(" ")}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6.25 3.75L11 8l-4.75 4.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type RootLinkProps = {
  isActive: boolean;
};

function RootLink({ isActive }: RootLinkProps) {
  return (
    <Link
      href={AI_ROOT_HREF}
      className={[
        "flex min-h-[40px] items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        isActive
          ? "border-l-2 border-l-slate-900 bg-slate-900 text-slate-50 hover:bg-slate-900"
          : "border-l-2 border-l-transparent bg-slate-800 text-slate-50 hover:bg-slate-900",
      ].join(" ")}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[11px] font-semibold">
        AI
      </span>
      <span className="font-semibold leading-snug">AI Command Center</span>
    </Link>
  );
}

