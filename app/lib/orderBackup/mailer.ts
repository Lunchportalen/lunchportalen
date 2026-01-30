// lib/orderBackup/mailer.ts
import nodemailer from "nodemailer";
import { getOrderBackupEnv } from "./env";
import type { OrderBackupInput } from "./types";
import { buildBackupSubject, buildBackupText } from "./format";

export async function sendBackupEmail(input: OrderBackupInput) {
  const env = getOrderBackupEnv();

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true for 465
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  const subject = buildBackupSubject(input);
  const text = buildBackupText(input);

  const info = await transporter.sendMail({
    from: env.MAIL_FROM,
    to: env.MAIL_TO,
    subject,
    text,
  });

  return { messageId: info.messageId ?? null };
}
