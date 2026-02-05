// components/marketing/PageShell.tsx
export default function PageShell({ children }: { children: React.ReactNode }) {
  // ✅ Header + footer eies av app/layout.tsx (én sannhet)
  // ✅ PageShell er kun en layout-wrapper for spacing.
  return <>{children}</>;
}
