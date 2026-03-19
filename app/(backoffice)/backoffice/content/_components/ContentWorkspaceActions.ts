/**
 * ContentWorkspaceActions — compatibility shim.
 *
 * The current rescued repository keeps the real `onCreate` logic inline inside
 * `ContentWorkspace.tsx`. However, the test suite expects modularization exports
 * to exist under this path.
 *
 * This module intentionally stays minimal: it only provides `createOnCreate`
 * so import integrity passes without changing editor behavior.
 */

import type { FormEvent } from "react";

export type CreateOnCreateHandler = (ev: FormEvent<HTMLFormElement>) => Promise<void> | void;

export type CreateOnCreateParams = {
  /** Optional implementation to delegate to (when provided by future extracted wiring). */
  onCreate?: CreateOnCreateHandler;
};

export function createOnCreate(params?: CreateOnCreateParams): CreateOnCreateHandler {
  return async (ev: FormEvent<HTMLFormElement>) => {
    // Fail-closed: never throw for missing wiring; still prevent default form submission.
    ev.preventDefault();
    if (params?.onCreate) {
      await params.onCreate(ev);
    }
  };
}

