"use client";

import { useRef } from "react";
import { Icon, type SemanticIconKey } from "../../_shell/icons";
import type { ContentTreeNode, TreePermissions } from "./treeTypes";
import { NodeActionsMenu } from "./NodeActionsMenu";

const ROW_HEIGHT = 36;

export type TreeNodeRowProps = {
  node: ContentTreeNode;
  level: number;
  isSelected: boolean;
  isExpanded: boolean;
  selectedId: string | null;
  expandedIds: Set<string>;
  basePath: string;
  onSelectAndNavigate: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onRowClick: (id: string) => void;
  permissions: TreePermissions;
  onCopyLink: (id: string) => void;
  onPreview: (slug: string) => void;
  onCreateChild: (parentId: string) => void;
  onRename: (id: string, currentName: string) => void;
  onMove: (id: string) => void;
  onDelete: (id: string) => void;
  actionsOpenNodeId: string | null;
  onOpenActions: (id: string | null) => void;
};

function iconNameForNode(node: ContentTreeNode): SemanticIconKey {
  if (node.icon === "home") return "home";
  if (node.icon === "folder") return "folder";
  // Preserve existing rendering behaviour: "document" nodes were shown with the folder icon.
  if (node.icon === "document") return "folder";
  return "folder";
}

export function TreeNodeRow({
  node,
  level,
  isSelected,
  isExpanded,
  basePath,
  onSelectAndNavigate,
  onToggleExpand,
  onRowClick,
  permissions,
  onCopyLink,
  onPreview,
  onCreateChild,
  onRename,
  onMove,
  onDelete,
  actionsOpenNodeId,
  onOpenActions,
}: TreeNodeRowProps) {
  const kebabRef = useRef<HTMLButtonElement>(null);
  const isActionsOpen = actionsOpenNodeId === node.id;
  const iconName: SemanticIconKey = node.id === "recycle-bin" ? "delete" : iconNameForNode(node);

  const handleRowClick = () => {
    onRowClick(node.id);
    onSelectAndNavigate(node.id);
  };

  const handleCaretClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleExpand(node.id);
  };

  const handleKebabClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenActions(isActionsOpen ? null : node.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRowClick();
      return;
    }
    if (e.key === " ") {
      e.preventDefault();
      onToggleExpand(node.id);
      return;
    }
    if (e.key === "ArrowRight" && node.hasChildren && !isExpanded) {
      e.preventDefault();
      onToggleExpand(node.id);
      return;
    }
    if (e.key === "ArrowLeft" && node.hasChildren && isExpanded) {
      e.preventDefault();
      onToggleExpand(node.id);
      return;
    }
    if (e.key === "Escape" && isActionsOpen) {
      onOpenActions(null);
      e.preventDefault();
    }
  };

  return (
    <div className="relative flex items-stretch" style={{ minHeight: ROW_HEIGHT }}>
      <div
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={node.hasChildren ? isExpanded : undefined}
        className={`flex w-full min-w-0 cursor-pointer items-center gap-1 truncate rounded-none border-l-2 py-0 pr-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-0 ${
          isSelected
            ? "border-l-red-500 bg-slate-100 font-medium text-slate-900"
            : "border-l-transparent text-slate-700 hover:bg-slate-50"
        }`}
        style={{ paddingLeft: 12 + level * 16, height: ROW_HEIGHT }}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
      >
        <span
          className="flex shrink-0 cursor-pointer rounded p-0.5 hover:bg-slate-200"
          onClick={handleCaretClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onToggleExpand(node.id);
            }
          }}
          role="button"
          tabIndex={-1}
          aria-label={isExpanded ? "Lukk" : "Utvid"}
        >
          {node.hasChildren ? (
            <Icon
              name="chevronRight"
              className="h-4 w-4 text-slate-500 transition-transform"
              style={{ transform: isExpanded ? "rotate(90deg)" : undefined }}
            />
          ) : (
            <span className="inline-block w-4" />
          )}
        </span>
        <Icon name={iconName} className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <div className="relative flex shrink-0">
          <button
            ref={kebabRef}
            type="button"
            aria-label="Handlinger"
            aria-expanded={isActionsOpen}
            aria-haspopup="menu"
            className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            onClick={handleKebabClick}
          >
            ⋯
          </button>
          {isActionsOpen && (
            <NodeActionsMenu
              node={node}
              anchorRef={kebabRef}
              open={true}
              onClose={() => onOpenActions(null)}
              permissions={permissions}
              onCopyLink={onCopyLink}
              onPreview={onPreview}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onMove={onMove}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
