// lib/system/runtimeFacts.ts
import "server-only";

function safeStr(v: any) {
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
  // 🔒 Låst i fasit: Europe/Oslo, cut-off 08:00
  // (Hvis dere senere flytter disse til egne konstanter, bytter vi kun her.)
  return {
    timezone: "Europe/Oslo",
    cutoffTimeLocal: "08:00",
    weekendOrdering: "Portalen bestiller Man–Fre. Lør/Søn bestilles utenfor portalen.",

    // 🔒 System-epost fasit
    orderBackupEmail: requireEnv("ORDER_BACKUP_EMAIL"), // f.eks ordre@lunchportalen.no

    // 🔒 Driftspunkter (fra env for å være “truthy”)
    smtpHost: requireEnv("SMTP_HOST"), // mail.lunchportalen.no
    smtpPorts: requireEnv("SMTP_PORTS"), // "465,587"
    imapHost: requireEnv("IMAP_HOST"), // mail.lunchportalen.no
    imapPort: requireEnv("IMAP_PORT"), // "993"
  };
}
