"use client";

import Card from "./Card";
import { highlightStyle } from "@/lib/demo/highlight";
import { useDemoModeActive } from "@/lib/demo/useDemoModeActive";
import { ui } from "@/lib/ui/tokens";

function actionLine(a: unknown): string {
  if (typeof a === "string") return a;
  if (a && typeof a === "object" && "message" in a && typeof (a as { message?: unknown }).message === "string") {
    return (a as { message: string }).message;
  }
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

export default function ActionPanel({ actions }: { actions?: unknown[] | null }) {
  const demo = useDemoModeActive();

  if (!actions?.length) return null;

  return (
    <div style={{ ...highlightStyle(demo) }}>
      <Card>
        <h3 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]" style={{ marginBottom: ui.spacing.md }}>
          ⚡ Prioriterte handlinger
        </h3>

        {actions.map((a, i) => (
          <div
            key={i}
            style={{
              padding: ui.spacing.sm,
              borderBottom: i < actions.length - 1 ? "1px solid rgba(0,0,0,0.06)" : undefined,
              cursor: "pointer",
            }}
            className="text-sm text-[rgb(var(--lp-text))] transition-colors duration-150 hover:bg-[#f9fafb]"
          >
            → {actionLine(a)}
          </div>
        ))}
      </Card>
    </div>
  );
}
