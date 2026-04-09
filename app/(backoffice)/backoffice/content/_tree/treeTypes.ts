/**
 * Content tree node model (Umbraco 13 parity).
 */

export type ContentTreeNode = {
  id: string;
  parentId: string | null;
  name: string;
  slug?: string;
  hasChildren: boolean;
  children?: ContentTreeNode[];
  status?: "draft" | "published";
  icon?: "home" | "folder" | "document";
  /** content_pages.page_key when present (e.g. employee_week). */
  kind?: string;
  nodeType?: "folder" | "page" | "root";
  /** Virtual Hjem root → Forside page id. */
  targetPageId?: string | null;
  /** Persisted sibling order from content_pages.tree_sort_order (pages only). */
  treeSortOrder?: number;
};

export type TreePermissions = {
  canCreate: boolean;
  canRename: boolean;
  canMove: boolean;
  canDelete: boolean;
};
