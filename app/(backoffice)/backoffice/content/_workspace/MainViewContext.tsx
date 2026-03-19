"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

export type MainView = "page" | "global" | "design";

type MainViewContextValue = {
  mainView: MainView;
  setMainView: (v: MainView) => void;
};

const DEFAULT_VALUE: MainViewContextValue = {
  mainView: "page",
  // Fail-closed: if the provider is missing, we don't allow view changes.
  setMainView: () => undefined,
};

const MainViewContext = createContext<MainViewContextValue>(DEFAULT_VALUE);

export function MainViewProvider({ children }: { children: ReactNode }) {
  const [mainView, setMainView] = useState<MainView>("page");

  const value = useMemo<MainViewContextValue>(
    () => ({
      mainView,
      setMainView,
    }),
    [mainView]
  );

  return <MainViewContext.Provider value={value}>{children}</MainViewContext.Provider>;
}

export function useMainView(): MainViewContextValue {
  return useContext(MainViewContext);
}

