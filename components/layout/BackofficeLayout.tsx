"use client";

import type { ReactNode } from "react";

import BackofficeShell from "@/app/(backoffice)/backoffice/_shell/BackofficeShell";

export default function BackofficeLayout({ children }: { children: ReactNode }) {
  return <BackofficeShell>{children}</BackofficeShell>;
}
