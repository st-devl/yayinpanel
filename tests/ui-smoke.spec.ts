import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "change-this-password";

const routes = [
  "/dashboard",
  "/accounts",
  "/instagram",
  "/x",
  "/blog",
  "/content",
  "/media",
  "/logs",
  "/settings",
  "/review"
];

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "E-posta" }).fill(adminEmail);
  await page.locator('input[name="password"]').fill(adminPassword);
  await page.getByRole("button", { name: /giriş yap/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

for (const route of routes) {
  test(`${route} renders without page-level horizontal overflow`, async ({
    page
  }, testInfo) => {
    await page.goto(route);

    const horizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;

      return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
    });

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`${route.slice(1)}.png`)
    });

    expect(horizontalOverflow).toBeLessThanOrEqual(2);
  });
}
