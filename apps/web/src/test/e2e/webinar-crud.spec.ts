import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "test-password-min-12";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/dashboard");
}

test("admin can create, publish, and delete a webinar", async ({ page }) => {
  test.slow();
  await login(page);

  await page.goto("/dashboard/webinars");
  await expect(page.getByRole("heading", { name: "Webinars" })).toBeVisible();

  const slug = `e2e-${Date.now()}`;

  await page.getByRole("button", { name: /Criar novo/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/webinars\/.+\/step-1$/);

  await page.getByLabel("Nome interno").fill("E2E Webinar");
  await page.getByLabel("Título público").fill("E2E Webinar Público");
  await page.getByLabel("URL amigável").fill(slug);
  await page.getByLabel("Idioma").fill("pt-BR");
  await page.getByRole("button", { name: /Continuar/ }).click();

  await expect(page).toHaveURL(/\/step-2$/);
  await page.getByRole("button", { name: /Continuar/ }).click();

  await expect(page).toHaveURL(/\/step-3$/);
  await page.getByRole("button", { name: /Continuar/ }).click();

  await expect(page).toHaveURL(/\/step-4$/);
  await page.getByLabel(/URL do vídeo/).fill("https://example.com/v.mp4");
  await page.getByRole("button", { name: /Continuar/ }).click();

  await expect(page).toHaveURL(/\/step-5$/);
  await page.getByRole("button", { name: /Continuar/ }).click();

  await expect(page).toHaveURL(/\/step-6$/);
  await page.getByRole("button", { name: /Salvar e Ativar/ }).click();
  await expect(page).toHaveURL("/dashboard/webinars");
  await expect(page.getByText("E2E Webinar Público")).toBeVisible();

  // Delete via row dropdown
  await page.getByText("E2E Webinar Público").locator("xpath=ancestor::tr").getByRole("button").last().click();
  await page.getByRole("menuitem", { name: /Excluir/ }).click();
  await page.getByRole("button", { name: /Excluir$/ }).click();
  await expect(page.getByText("E2E Webinar Público")).toHaveCount(0);
});
