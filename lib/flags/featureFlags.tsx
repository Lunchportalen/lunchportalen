// STATUS: KEEP

// lib/flags/featureFlags.tsx
"use client";

import React, { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

export type FeatureFlags = Record<string, boolean>;

type FeatureFlagsCtxValue = {
  flags: FeatureFlags;
  isOn: (key: string) => boolean;
};

const FeatureFlagsCtx = createContext<FeatureFlagsCtxValue | null>(null);

export function FeatureFlagsProvider({
  children,
  flags,
}: {
  children: ReactNode;
  flags: FeatureFlags;
}) {
  // Keep stable reference if caller memoizes `flags` (recommended)
  const stableFlags = useMemo(() => flags, [flags]);

  const isOn = useCallback((key: string) => Boolean(stableFlags[key]), [stableFlags]);

  const value = useMemo<FeatureFlagsCtxValue>(
    () => ({ flags: stableFlags, isOn }),
    [stableFlags, isOn]
  );

  return <FeatureFlagsCtx.Provider value={value}>{children}</FeatureFlagsCtx.Provider>;
}

export function useFeatureFlags() {
  const v = useContext(FeatureFlagsCtx);
  if (!v) throw new Error("useFeatureFlags må brukes innenfor <FeatureFlagsProvider />");
  return v;
}
