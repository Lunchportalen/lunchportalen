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
};

export type TreePermissions = {
  canCreate: boolean;
  canRename: boolean;
  canMove: boolean;
  canDelete: boolean;
};
