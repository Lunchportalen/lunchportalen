import type { ReactNode } from "react";

import "@/app/styles/ds/demo-page-blocks.css";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lp-demo-capture-page mx-auto w-full max-w-xl px-4 py-10 text-center">{children}</div>
  );
}
