import * as React from "react";
import { act as legacyAct } from "react-dom/test-utils";

type ActFn = typeof legacyAct;

function resolveAct(): ActFn {
  const fromReact = (React as { act?: ActFn }).act;
  return typeof fromReact === "function" ? fromReact : legacyAct;
}

/** Canonical Vitest act — prefers React.act when the test renderer is wired. */
export const act = resolveAct();
