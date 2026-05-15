"use client";

import { useEffect, useId, useRef, useState } from "react";

import { LogoutClientButton } from "@/components/auth/LogoutClient";

export type AdminTopbarUserMenuProps = {
  displayName: string;
  email: string;
  roleLabel: string;
};

function initialsFromDisplay(displayName: string, email: string): string {
  const d = String(displayName ?? "").trim();
  if (d) {
    const parts = d.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0];
      const b = parts[1][0];
      if (a && b) return (a + b).toUpperCase();
    }
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    if (parts[0][0]) return parts[0][0].toUpperCase();
  }
  const e = String(email ?? "").trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return "?";
}

export default function AdminTopbarUserMenu({ displayName, email, roleLabel }: AdminTopbarUserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(ev: PointerEvent) {
      const el = wrapRef.current;
      if (!el) return;
      const t = ev.target as Node | null;
      if (t && !el.contains(t)) setOpen(false);
    }

    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const initials = initialsFromDisplay(displayName, email);
  const label = displayName || email || "Bruker";

  return (
    <div className="ds-admin-topbar__user" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="ds-admin-user-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ds-admin-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="ds-admin-user-trigger__name">{label}</span>
      </button>

      {open ? (
        <div className="ds-admin-user-menu" id={menuId} role="menu" aria-label="Brukermeny">
          <div className="ds-admin-user-menu__header">
            <strong className="ds-admin-user-menu__title">{label}</strong>
            {email ? (
              <small className="ds-admin-user-menu__email" title={email}>
                {email}
              </small>
            ) : null}
            <span className="ds-admin-user-menu__role ds-admin-topbar__eyebrow">{roleLabel}</span>
          </div>

          <LogoutClientButton className="ds-admin-user-menu__logout" role="menuitem" />
        </div>
      ) : null}
    </div>
  );
}
