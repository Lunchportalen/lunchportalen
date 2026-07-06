import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Local-only operator credential sink under process.cwd()/.operator-local/
 * (never printed, never committed). Inviter-set passwords only.
 */

export type OperatorLocalCredentialRecord = {
  schemaVersion: 1;
  providerId: string;
  adminEmail: string;
  temporaryPassword: string;
  passwordPrinted: false;
  createdAt: string;
};

export type StoreOperatorLocalCredentialsInput = {
  providerId: string;
  adminEmail: string;
  temporaryPassword: string;
  createdAt?: string;
};

export function operatorLocalCredentialsRoot(): string {
  const override = process.env.PHASE_C_OPERATOR_CREDENTIALS_DIR?.trim();
  if (override) return override;
  return join(process.cwd(), ".operator-local");
}

/** Map admin email to `<local-part-lowercased>.credentials` under `.operator-local`. */
export function operatorLocalCredentialsPathForEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const localPart = normalized.includes("@")
    ? normalized.slice(0, normalized.indexOf("@"))
    : normalized;
  const safe = localPart.replace(/[^\w.+-]+/g, "_");
  return join(operatorLocalCredentialsRoot(), `${safe}.credentials`);
}

export function storeOperatorLocalCredentials(
  input: StoreOperatorLocalCredentialsInput,
): string {
  const path = operatorLocalCredentialsPathForEmail(input.adminEmail);
  mkdirSync(operatorLocalCredentialsRoot(), { recursive: true });
  const payload: OperatorLocalCredentialRecord = {
    schemaVersion: 1,
    providerId: input.providerId,
    adminEmail: input.adminEmail.trim().toLowerCase(),
    temporaryPassword: input.temporaryPassword,
    passwordPrinted: false,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return path;
}

/** Load credentials from an explicit absolute/relative file path. */
export function loadOperatorLocalCredentials(
  filePath: string,
): OperatorLocalCredentialRecord | null {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as OperatorLocalCredentialRecord;
    if (
      typeof parsed.adminEmail !== "string" ||
      typeof parsed.temporaryPassword !== "string" ||
      !parsed.temporaryPassword
    ) {
      return null;
    }
    return {
      ...parsed,
      passwordPrinted: false,
    };
  } catch {
    return null;
  }
}
