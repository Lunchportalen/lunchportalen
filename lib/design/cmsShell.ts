/**
 * CMS / backoffice shell surfaces — uses canonical --lp-* tokens only.
 * No parallel token system; class strings for repeated layout shells.
 */

/** Main workspace column (tree | workspace grids): warm neutral, not raw slate. */
export const cmsWorkspaceMainSurfaceClass =
  "min-h-0 min-w-0 overflow-y-auto bg-[rgb(var(--lp-surface-alt))]/90";

/** Left tree column in section layouts — glass + right border for clear separation from main. */
export const cmsSectionTreeAsideClass =
  "lp-glass-panel flex h-full min-h-0 flex-col overflow-y-auto border-r border-[rgb(var(--lp-border))]";
