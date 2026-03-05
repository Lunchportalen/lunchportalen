"use client";

import type { ReactNode } from "react";
import TopBar from "./TopBar";
import ModulesRail from "./ModulesRail";

type BackofficeShellProps = {
  children: ReactNode;
};

export default function BackofficeShell({ children }: BackofficeShellProps) {
  return (
    <div className="flex h-screen flex-col bg-white">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ModulesRail />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
