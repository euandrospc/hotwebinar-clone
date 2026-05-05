import { test, expect } from "@playwright/test";

test("opt-in → live page renders video element + chat panel", async ({ page }) => {
  // assumes a JIT webinar with slug "e2e-funnel" and an EXTERNAL HLS URL exists in seed
  await page.goto("/e2e-funnel");

  await page.fill('input[name="name"]', "E2E Tester");
  await page.fill('input[name="email"]', `e2e+${Date.now()}@example.com`);
  // phone field uses libphonenumber input; type into the visible input child
  const phoneRoot = page.locator(".PhoneInput input");
  if (await phoneRoot.count()) {
    await phoneRoot.first().fill("11999990000");
  }
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/e2e-funnel\/live$/);
  await expect(page.locator("video")).toBeVisible();
  await expect(page.locator("aside")).toContainText("Chat ao vivo");
});
