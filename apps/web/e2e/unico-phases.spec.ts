import { test, expect } from "@playwright/test";

test("UNICO before startDate shows countdown view", async ({ page }) => {
  // assumes seed has webinar slug "e2e-future" with startDate 1h in future
  await page.goto("/e2e-future");
  await expect(page.locator("h1")).toContainText("Sala de Espera");
});

test("UNICO after endDate shows closed view", async ({ page }) => {
  // assumes seed has webinar slug "e2e-past" with endDate in the past
  await page.goto("/e2e-past");
  await expect(page.locator("p")).toContainText("Este webinar já foi encerrado");
});
