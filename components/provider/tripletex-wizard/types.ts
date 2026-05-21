export type WizardScreen = "token" | "provisioning" | "webhook" | "success";

export type VerifyItemState = "idle" | "pending" | "success" | "error";

export type VerifyItemKey = "auth" | "company_match" | "scope";

export const WIZARD_PROGRESS_LABELS = [
  "Token",
  "Verifiser",
  "Oppsett",
  "Webhook",
  "Ferdig",
] as const;

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
