"use client";

import React from "react";

export function BellissimaWorkspaceInspectorSection({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-zinc-200 bg-white"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          {description ? (
            <div className="text-xs text-zinc-500">{description}</div>
          ) : null}
        </div>
        <span className="text-zinc-400 transition group-open:rotate-180">⌄</span>
      </summary>

      <div className="border-t border-zinc-200 px-4 py-4">{children}</div>
    </details>
  );
}