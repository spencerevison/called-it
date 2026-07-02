import { expect, test } from "@playwright/test";

// placeholder smoke test - real flows land in T36
test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Called It" })).toBeVisible();
});
