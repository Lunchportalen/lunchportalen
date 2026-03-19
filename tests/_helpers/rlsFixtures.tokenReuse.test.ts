/**
 * Regression: createAccessToken reuses cached token for same (email, password)
 * so we do not hit sign-in rate limits when the same user is requested again.
 */
import crypto from "node:crypto";
import { describe, test, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createAccessToken } from "./rlsFixtures";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasDb = Boolean(url?.trim() && serviceKey?.trim());

describe("RLS fixtures token reuse", () => {
  test.skipIf(!hasDb)(
    "createAccessToken returns same token for same (email, password) without repeated sign-in",
    async () => {
      const admin = createClient(url!, serviceKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const email = `token-reuse.${crypto.randomUUID().slice(0, 8)}@test.lunchportalen.no`;
      const password = crypto.randomBytes(20).toString("hex");

      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !createData?.user?.id) {
        throw new Error(`createUser failed: ${createError?.message ?? "unknown"}`);
      }
      const userId = createData.user.id;

      try {
        const token1 = await createAccessToken(admin, email, password);
        const token2 = await createAccessToken(admin, email, password);
        expect(token1).toBeTruthy();
        expect(token2).toBe(token1);
      } finally {
        try {
          await admin.auth.admin.deleteUser(userId);
        } catch {
          // ignore
        }
      }
    }
  );
});
