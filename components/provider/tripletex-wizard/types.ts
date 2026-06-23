export type WizardScreen = "token" | "provisioning" | "webhook" | "success";

export type VerifyItemState = "idle" | "pending" | "success" | "error" | "skipped";

export type VerifyItemKey = "auth" | "company_match" | "scope";

export const WIZARD_PROGRESS_KEYS = ["token", "verify", "setup", "webhook", "done"] as const;

export type WizardProgressKey = (typeof WIZARD_PROGRESS_KEYS)[number];

export function progressIndexForScreen(
  screen: WizardScreen,
  verifying: boolean,
): number {
  switch (screen) {
    case "token":
      return verifying ? 1 : 0;
    case "provisioning":
      return 2;
    case "webhook":
      return 3;
    case "success":
      return 4;
    default:
      return 0;
  }
}
