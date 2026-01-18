// app/(app)/layout.tsx
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // ✅ Root header ligger i app/layout.tsx
  // ✅ Dette segmentet skal kun være en “container/surface” for app-sider
  return (
    <section className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)]">
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </section>
  );
}
