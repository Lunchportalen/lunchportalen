/**
 * LinkedIn: aldri automatisk utsendelse — kun utkast med tydelig manuell instruks.
 */
export type LinkedInDraft = {
  type: "linkedin";
  text: string;
  instruction: string;
  name: string;
};

export function createLinkedInDraft({ name, message }: { name: string; message: string }): LinkedInDraft {
  return {
    type: "linkedin",
    text: message,
    instruction: "Copy this into LinkedIn manually",
    name: name.trim() || "Contact",
  };
}
