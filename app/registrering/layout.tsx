// app/register/layout.tsx
import type { ReactNode } from "react";

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fffaf3]">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="mb-8 text-center">
          <div className="text-sm text-neutral-600">Lunchportalen</div>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Registrering</h1>
        </div>

        {children}

        <div className="mt-10 text-center text-xs text-neutral-500">© {new Date().getFullYear()} Lunchportalen</div>
      </div>
    </div>
  );
}
