import type { ReactNode } from "react";

import "@/app/styles/ds/start-gate.css";

export default function StartLayout({ children }: { children: ReactNode }) {
  return <div className="lp-start-page">{children}</div>;
}
