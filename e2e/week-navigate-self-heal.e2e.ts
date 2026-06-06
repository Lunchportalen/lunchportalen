// Self-heal gate — navigateToWeek recovers when concurrent seed invalidates storageState session
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { test, expect } from "@playwright/test";

import { getCredentialsForRole } from "./helpers/auth";
import {
  buildWeekVisualWindowDaySelected,
  installWeekVisualMocks,
  navigateToWeek,
  waitForWeekVisualReady,
} from "./helpers/week-visual";

const hasEmployeeCreds = !!getCredentialsForRole("employee");

test.describe("Week navigate self-heal", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* required");

  test("navigateToWeek re-auths after admin password-sync invalidates session", async ({
    page,
  }) => {
    const loginPosts: string[] = [];

    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() === "POST" && path.endsWith("/api/auth/login")) {
        loginPosts.push(request.url());
      }
    });

    await installWeekVisualMocks(page, {
      allergenProfile: "has_data",
      windowBody: buildWeekVisualWindowDaySelected(),
    });

    await navigateToWeek(page);
    await expect(page).toHaveURL(/\/week/);

    const postsBeforeInvalidate = loginPosts.length;

    execFileSync(process.execPath, [join(process.cwd(), "scripts/e2e/invalidate-employee-session.mjs")], {
      stdio: "inherit",
      env: process.env,
    });

    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await expect(page).toHaveURL(/\/week/);

    expect(loginPosts.length).toBeGreaterThan(postsBeforeInvalidate);
    expect(
      page.getByRole("heading", { name: /bestill eller avbestill lunsj/i }),
    ).toBeVisible();
  });
});
