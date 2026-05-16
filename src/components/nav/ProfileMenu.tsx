"use client";

import { User } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { LogoutClientButton } from "@/components/auth/LogoutClient";

export type ProfileMenuProps = {
  email: string | null;
  className?: string;
};

export function ProfileMenu({ email, className }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    }
    function onMouseDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) close();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, close]);

  return (
    <div ref={wrapRef} className={["lp-profile-menu", className].filter(Boolean).join(" ")}>
      <div className="lp-profile-menu__touch">
        <button
          ref={btnRef}
          type="button"
          className="lp-profile-menu__btn"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label="Brukermeny"
          onClick={() => setOpen((v) => !v)}
        >
          <User size={20} strokeWidth={2} aria-hidden />
        </button>
      </div>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Brukerkonto"
          className="lp-profile-menu__panel"
        >
          {email ? (
            <>
              <p className="lp-profile-menu__caption">Logget inn som</p>
              <p className="lp-profile-menu__email">{email}</p>
              <div className="lp-profile-menu__separator" aria-hidden="true" />
            </>
          ) : null}
          <LogoutClientButton className="lp-profile-menu__logout" role="menuitem" />
        </div>
      ) : null}
    </div>
  );
}
