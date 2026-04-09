export const CONTENT_TREE_ROOT_KEYS = ["home", "overlays", "global", "design"] as const;

export type ContentTreeRootKey = (typeof CONTENT_TREE_ROOT_KEYS)[number];

export const CONTENT_TREE_HOME_ROOT_ID = "home" as const;

export const CONTENT_TREE_FOLDER_ROOT_IDS = ["overlays", "global", "design"] as const;

export const CONTENT_TREE_FIXED_PAGE_KINDS = [
  "employee_week",
  "superadmin",
  "company_admin",
  "kitchen",
  "driver",
] as const;

export type ContentTreeFixedPageKind = (typeof CONTENT_TREE_FIXED_PAGE_KINDS)[number];

export type ContentTreeVirtualRootNode = {
  id: ContentTreeRootKey;
  rootKey: ContentTreeRootKey;
  parentId: null;
  name: string;
  slug?: string;
  hasChildren: true;
  icon: "home" | "folder";
  kind: string;
  nodeType: "root" | "folder";
  targetPageId: string | null;
};

export const CONTENT_TREE_VIRTUAL_ROOTS: readonly ContentTreeVirtualRootNode[] = [
  {
    id: "home",
    rootKey: "home",
    parentId: null,
    name: "Hjem",
    slug: "home",
    hasChildren: true,
    icon: "home",
    kind: "home",
    nodeType: "root",
    targetPageId: null,
  },
  {
    id: "overlays",
    rootKey: "overlays",
    parentId: null,
    name: "App overlays",
    hasChildren: true,
    icon: "folder",
    kind: "app_overlay_folder",
    nodeType: "folder",
    targetPageId: null,
  },
  {
    id: "global",
    rootKey: "global",
    parentId: null,
    name: "Global",
    hasChildren: true,
    icon: "folder",
    kind: "global",
    nodeType: "folder",
    targetPageId: null,
  },
  {
    id: "design",
    rootKey: "design",
    parentId: null,
    name: "Design",
    hasChildren: true,
    icon: "folder",
    kind: "design",
    nodeType: "folder",
    targetPageId: null,
  },
] as const;

export function isContentTreeRootKey(value: string): value is ContentTreeRootKey {
  return (CONTENT_TREE_ROOT_KEYS as readonly string[]).includes(value);
}

export function isContentTreeFolderRootId(value: string): value is (typeof CONTENT_TREE_FOLDER_ROOT_IDS)[number] {
  return (CONTENT_TREE_FOLDER_ROOT_IDS as readonly string[]).includes(value);
}

export function isContentTreeFixedPageKind(value: string | null | undefined): value is ContentTreeFixedPageKind {
  if (!value) return false;
  return (CONTENT_TREE_FIXED_PAGE_KINDS as readonly string[]).includes(value.trim().toLowerCase());
}

export function cloneContentTreeVirtualRoots(): ContentTreeVirtualRootNode[] {
  return CONTENT_TREE_VIRTUAL_ROOTS.map((root) => ({ ...root }));
}
