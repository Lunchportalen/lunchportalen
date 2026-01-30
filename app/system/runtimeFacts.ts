// lib/system/runtimeFacts.ts
import "server-only";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !safeStr(v)) throw new Error(`Missing env: ${name}`);
  return safeStr(v);
}

export type RuntimeFacts = {
  timezone: string;
  cutoffTimeLocal: string; // "08:00"
  weekendOrdering: string;

  orderBackupEmail: string;

  smtpHost: string;
  smtpPorts: string;

  imapHost: string;
  imapPort: string;
};

export function getRuntimeFacts(): RuntimeFacts {
  return {
    timezone: "Europe/Oslo",
    cutoffTimeLocal: "08:00",
    weekendOrdering: "Portalen bestiller Man–Fre. Lør/Søn bestilles utenfor portalen.",

    orderBackupEmail: requireEnv("ORDER_BACKUP_EMAIL"),

    smtpHost: requireEnv("SMTP_HOST"),
    smtpPorts: requireEnv("SMTP_PORTS"),
    imapHost: requireEnv("IMAP_HOST"),
    imapPort: requireEnv("IMAP_PORT"),
  };
}
