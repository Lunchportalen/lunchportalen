"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { workspaceActionLabel } from "@/lib/cms/backofficeWorkspaceContextModel";
import type { ContentTreeNode, TreePermissions } from "./treeTypes";

export type NodeActionsMenuProps = {
  node: ContentTreeNode;
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  permissions: TreePermissions;
  onEdit: (id: string) => void;
  onCopyLink: (id: string) => void;
  onPreview: (slug: string) => void;
  onCreateChild: (parentId: string) => void;
  onRename: (id: string, currentName: string) => void;
  onMove: (id: string) => void;
  onDelete: (id: string) => void;
};

const MENU_MIN_WIDTH = 220;
const MENU_EST_HEIGHT = 320;
const GAP = 6;
const PADDING = 8;

export function NodeActionsMenu({
  node,
  anchorRef,
  open,
  onClose,
  permissions,
  onEdit,
  onCopyLink,
  onPreview,
  onCreateChild,
  onRename,
  onMove,
  onDelete,
}: NodeActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const anchorRect = anchorRef.current.getBoundingClientRect();
    const menuHeight = Math.min(MENU_EST_HEIGHT, window.innerHeight - PADDING * 2);
    const top = Math.min(
      anchorRect.bottom + GAP,
      window.innerHeight - menuHeight - PADDING
    );
    const left = Math.min(
      anchorRect.left,
      window.innerWidth - MENU_MIN_WIDTH - PADDING
    );
    setPosition({ top, left });
  }, [open, anchorRef]);

  const isHome =
    node.id === "home" || node.id === "root" || node.id === "home-root";
  const canDelete = !isHome && permissions.canDelete;
  const canMove = !isHome && permissions.canMove;
  const hasSlug = Boolean(node.slug?.trim());

  const items = useMemo(
    () =>
      [
        {
          key: "edit",
          label: workspaceActionLabel("edit"),
          disabled: false,
          onSelect: () => onEdit(node.id),
        },
        {
          key: "create",
          label: "Opprett under",
          disabled: !permissions.canCreate,
          onSelect: () => onCreateChild(node.id),
        },
        {
          key: "rename",
          label: "Omdøp",
          disabled: !permissions.canRename,
          onSelect: () => onRename(node.id, node.name),
        },
        {
          key: "copy",
          label: workspaceActionLabel("copy_link"),
          disabled: false,
          onSelect: () => onCopyLink(node.id),
        },
        {
          key: "preview",
          label: workspaceActionLabel("preview"),
          disabled: !hasSlug,
          onSelect: () => hasSlug && node.slug && onPreview(node.slug),
        },
        {
          key: "move",
          label: "Flytt",
          disabled: !canMove,
          onSelect: () => {
            if (isHome) return;
            onMove(node.id);
          },
        },
        {
          key: "delete",
          label: "Slett",
          disabled: !canDelete,
          onSelect: () => {
            if (isHome) return;
            onDelete(node.id);
          },
        },
      ] as const,
    [
      canDelete,
      canMove,
      hasSlug,
      isHome,
      node.id,
      node.name,
      node.slug,
      onCopyLink,
      onCreateChild,
      onDelete,
      onEdit,
      onMove,
      onPreview,
      onRename,
      permissions.canCreate,
      permissions.canRename,
    ]
  );

  const enabledItems = useMemo(() => items.filter((i) => !i.disabled), [items]);
  const count = enabledItems.length;

  useEffect(() => {
    if (!open) return;
    setFocusedIndex(0);
    const el = menuRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>("[data-action-item]");
    first?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowDown" && focusedIndex < count - 1) {
        setFocusedIndex((i) => i + 1);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp" && focusedIndex > 0) {
        setFocusedIndex((i) => i - 1);
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        const item = enabledItems[focusedIndex];
        if (item && !items.find((i) => i.key === item.key)?.disabled) {
          item.onSelect();
          onClose();
          e.preventDefault();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, focusedIndex, count, enabledItems, items, onClose]);

  if (!open) return null;

  const menuContent = (
    <>
      <div
        className="fixed inset-0 z-[9998]"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={menuRef}
        role="menu"
        aria-label="Node-handlinger"
        data-lp-create-child-dialog
        className="z-[9999] min-w-[220px] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          maxHeight:
            typeof window !== "undefined"
              ? window.innerHeight - position.top - PADDING
              : 400,
          overflowY: "auto",
        }}
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            data-action-item
            data-lp-create-child-option={item.key === "create" ? "" : undefined}
            data-lp-create-child-option-alias={item.key === "create" ? "create-under" : undefined}
            disabled={item.disabled}
            className={`flex w-full items-center px-3 py-1.5 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 ${
              item.disabled
                ? "cursor-not-allowed text-slate-400"
                : "text-slate-800 hover:bg-slate-100"
            }`}
            onClick={() => {
              if (item.disabled) return;
              item.onSelect();
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );

  return createPortal(menuContent, document.body);
}
