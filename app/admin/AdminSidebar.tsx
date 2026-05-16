import { AdminSidebarNav, AdminSidebarUser } from "./AdminSidebar.client";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export function initialsFromName(value: unknown) {
  const text = safeStr(value);
  if (!text) return "LP";
  const cleaned = text.includes("@") ? text.split("@")[0] : text;
  const parts = cleaned
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "LP";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

export default function AdminSidebar({
  companyName,
  userName,
  showFirmadashbordLink = false,
}: {
  companyName: string;
  userName: string;
  /** Kun for firmaadmin (company_admin). */
  showFirmadashbordLink?: boolean;
}) {
  return (
    <aside className="ds-admin-sidebar">
      <div className="ds-admin-sidebar__brand">
        <div className="ds-admin-sidebar__mark">LP</div>
        <div>
          <div className="ds-admin-sidebar__name">Lunchportalen</div>
          <div className="ds-admin-sidebar__sub">{companyName}</div>
        </div>
      </div>

      <AdminSidebarNav showFirmadashbordLink={showFirmadashbordLink} />
      <AdminSidebarUser initials={initialsFromName(userName)} userName={userName} />
    </aside>
  );
}
