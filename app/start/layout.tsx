import type { ReactNode } from "react";

import "@/app/styles/ds/start-gate.css";

export default function StartLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lp-start-page">
      <div className="lp-start-canvas" aria-hidden="true">
        <span className="lp-start-orb lp-start-orb--a" />
        <span className="lp-start-orb lp-start-orb--b" />
        <span className="lp-start-orb lp-start-orb--c" />
      </div>
      {children}
    </div>
  );
}
