"use client";

import * as React from "react";
import type { ReactNode } from "react";

/**
 * Center column: page title + block builder or preview (shell).
 * Parent passes all editor UI as children — no data or save logic here.
 */
export const EditorCanvas = React.forwardRef<
  HTMLElement,
  { children: ReactNode; documentSurface?: boolean }
>(function EditorCanvas({ children, documentSurface = false }, ref) {
  return (
    <main
      ref={ref}
      id="lp-content-editor-canvas"
      className={
        documentSurface
          ? "min-h-0 min-w-0 overflow-y-auto bg-white"
          : "min-h-0 min-w-0 overflow-y-auto bg-[rgb(var(--lp-card))]"
      }
    >
      <div className={documentSurface ? "min-w-0 space-y-2 px-2 py-2 md:px-3 md:py-3" : "min-w-0 space-y-3 p-3 md:p-4"}>
        {children}
      </div>
    </main>
  );
});

EditorCanvas.displayName = "EditorCanvas";
