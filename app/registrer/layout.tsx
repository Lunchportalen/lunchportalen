import type { ReactNode } from "react";

import "@/app/styles/ds/demo-page-blocks.css";
import "@/app/styles/ds/registrer-public.css";

export default function RegistrerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lp-registrer-page mx-auto w-full max-w-xl px-4 py-10 text-center">{children}</div>
  );
}
