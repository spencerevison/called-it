import { test, expect } from "@playwright/test";

// placeholder smoke test — real happy-path flow lands in T36
test("home page loads and renders the app name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Called It")).toBeVisible();
});
