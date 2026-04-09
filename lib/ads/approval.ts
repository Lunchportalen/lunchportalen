/**
 * Manuell godkjenning + kortlevd HMAC-bevis (SYSTEM_MOTOR_SECRET) — ingen publisering uten begge.
 */

import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 15 * 60 * 1000;

export function requireApproval(action: string): { approved: false; reason: string } {
  return {
    approved: false,
    reason: `Manual approval required (${action})`,
  };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Stabil streng for signering (kun felter som må matche ved publisering). */
export function canonicalCampaignForApproval(c: {
  name: string;
  creative: string | null;
  text: string;
  cta: string;
  productId: string;
  conversionVideoId: string | null;
  postId: string | null;
}): string {
  const payload = {
    name: c.name,
    creative: c.creative,
    text: c.text,
    cta: c.cta,
    productId: c.productId,
    conversionVideoId: c.conversionVideoId,
    postId: c.postId,
  };
  return sha256Hex(JSON.stringify(payload));
}

export type ApprovalIssueOk = { proof: string; expiresAt: number };
export type ApprovalIssueErr = { error: string };

export function issueAdApprovalProof(
  userId: string,
  campaignDigest: string,
  budget: number,
): ApprovalIssueOk | ApprovalIssueErr {
  const secret = process.env.SYSTEM_MOTOR_SECRET?.trim();
  if (!secret) {
    return { error: "SYSTEM_MOTOR_SECRET mangler — godkjenning blokkert" };
  }
  if (!(typeof budget === "number" && Number.isFinite(budget) && budget > 0)) {
    return { error: "Budsjett må være et positivt tall før godkjenning" };
  }
  const uid = userId.trim();
  if (!uid) {
    return { error: "Mangler bruker for godkjenning" };
  }
  const exp = Date.now() + TTL_MS;
  const msg = `${uid}|${campaignDigest}|${budget}|${exp}`;
  const sig = createHmac("sha256", secret).update(msg, "utf8").digest("hex");
  const proof = Buffer.from(JSON.stringify({ exp, sig, uid, budget, d: campaignDigest }), "utf8").toString(
    "base64url",
  );
  return { proof, expiresAt: exp };
}

export function verifyAdApprovalProof(
  userId: string,
  campaignDigest: string,
  budget: number,
  proof: string,
): boolean {
  const secret = process.env.SYSTEM_MOTOR_SECRET?.trim();
  if (!secret) return false;
  try {
    const raw = JSON.parse(Buffer.from(proof, "base64url").toString("utf8")) as {
      exp?: number;
      sig?: string;
      uid?: string;
      budget?: number;
      d?: string;
    };
    if (
      typeof raw.exp !== "number" ||
      typeof raw.sig !== "string" ||
      typeof raw.uid !== "string" ||
      typeof raw.budget !== "number" ||
      typeof raw.d !== "string"
    ) {
      return false;
    }
    if (Date.now() > raw.exp) return false;
    if (raw.uid !== userId.trim()) return false;
    if (raw.budget !== budget) return false;
    if (raw.d !== campaignDigest) return false;
    const msg = `${raw.uid}|${raw.d}|${raw.budget}|${raw.exp}`;
    const expected = createHmac("sha256", secret).update(msg, "utf8").digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(raw.sig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Stabil hash for ROAS-budsjettendring (godkjenning før apply). */
export function canonicalRoasBudgetPayloadHash(p: {
  campaignDigest: string;
  fromBudget: number;
  toBudget: number;
  spend: number;
  revenue: number;
  paused: boolean;
}): string {
  const payload = {
    campaignDigest: p.campaignDigest,
    fromBudget: p.fromBudget,
    toBudget: p.toBudget,
    spend: p.spend,
    revenue: p.revenue,
    paused: p.paused,
  };
  return sha256Hex(JSON.stringify(payload));
}

export function issueRoasBudgetChangeProof(
  userId: string,
  roasPayloadHash: string,
): ApprovalIssueOk | ApprovalIssueErr {
  const secret = process.env.SYSTEM_MOTOR_SECRET?.trim();
  if (!secret) {
    return { error: "SYSTEM_MOTOR_SECRET mangler — ROAS-godkjenning blokkert" };
  }
  const h = roasPayloadHash.trim();
  if (!h) {
    return { error: "Mangler ROAS-nyttelast-hash" };
  }
  const uid = userId.trim();
  if (!uid) {
    return { error: "Mangler bruker for godkjenning" };
  }
  const exp = Date.now() + TTL_MS;
  const msg = `${uid}|roas_budget|${h}|${exp}`;
  const sig = createHmac("sha256", secret).update(msg, "utf8").digest("hex");
  const proof = Buffer.from(JSON.stringify({ exp, sig, uid, h, kind: "roas_budget" }), "utf8").toString(
    "base64url",
  );
  return { proof, expiresAt: exp };
}

export function verifyRoasBudgetChangeProof(userId: string, roasPayloadHash: string, proof: string): boolean {
  const secret = process.env.SYSTEM_MOTOR_SECRET?.trim();
  if (!secret) return false;
  try {
    const raw = JSON.parse(Buffer.from(proof, "base64url").toString("utf8")) as {
      exp?: number;
      sig?: string;
      uid?: string;
      h?: string;
      kind?: string;
    };
    if (
      typeof raw.exp !== "number" ||
      typeof raw.sig !== "string" ||
      typeof raw.uid !== "string" ||
      typeof raw.h !== "string" ||
      raw.kind !== "roas_budget"
    ) {
      return false;
    }
    if (Date.now() > raw.exp) return false;
    if (raw.uid !== userId.trim()) return false;
    if (raw.h !== roasPayloadHash.trim()) return false;
    const msg = `${raw.uid}|roas_budget|${raw.h}|${raw.exp}`;
    const expected = createHmac("sha256", secret).update(msg, "utf8").digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(raw.sig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
