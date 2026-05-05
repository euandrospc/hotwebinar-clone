import { test, expect } from "@playwright/test";

test("admin sees failed webhook delivery and can retry", async ({ page }) => {
  // assumes admin is already logged in via Playwright global setup
  // and a webinar with id "e2e-webhook" has a FAILED WebhookDelivery seeded
  await page.goto("/dashboard/webinars/e2e-webhook/webhooks");
  await expect(page.locator("text=FAILED")).toBeVisible();
  const retryBtn = page.locator('button:has-text("Reenviar")').first();
  await retryBtn.click();
  await expect(page.locator("text=Reenviado")).toBeVisible({ timeout: 5000 });
});
