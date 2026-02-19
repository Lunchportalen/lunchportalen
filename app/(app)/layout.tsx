// app/(app)/layout.tsx
export const dynamic = "force-dynamic";

import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  // ✅ Root header ligger i app/layout.tsx
  // ✅ Dette segmentet skal kun være en “container/surface” for app-sider
  return (
    <section className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] overflow-x-hidden">
      <div
        className="mx-auto max-w-6xl px-4 py-6"
        suppressHydrationWarning
      >
        {children}
      </div>
    </section>
  );
}
