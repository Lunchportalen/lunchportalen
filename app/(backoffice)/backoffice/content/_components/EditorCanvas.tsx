"use client";

import * as React from "react";
import type { ReactNode } from "react";

/**
 * Center column: page title + block builder or preview (shell).
 * Parent passes all editor UI as children — no data or save logic here.
 */
export const EditorCanvas = React.forwardRef<HTMLElement, { children: ReactNode }>(function EditorCanvas(
  { children },
  ref,
) {
  return (
    <main
      ref={ref}
      id="lp-content-editor-canvas"
      className="min-h-0 min-w-0 overflow-y-auto bg-[rgb(var(--lp-card))]"
    >
      <div className="min-w-0 space-y-3 p-3 md:p-4">{children}</div>
    </main>
  );
});

EditorCanvas.displayName = "EditorCanvas";
