import "./env";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";

// T52 — axe scan of the core pages (login, decision form, decision detail,
// check-in flow). Asserts zero serious/critical violations per the task AC;
// moderate/minor findings aren't gated here.
//
// Needs `supabase start`, same as happy-path.spec.ts.

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const testEmail = "e2e-a11y@example.com";
let userId: string;

async function assertNoSeriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.beforeAll(async () => {
  const { data: existing } = await svc.auth.admin.listUsers();
  const stale = existing.users.find((u) => u.email === testEmail);
  if (stale) {
    await svc.from("decisions").delete().eq("user_id", stale.id);
    await svc.from("profiles").delete().eq("user_id", stale.id);
    await svc.auth.admin.deleteUser(stale.id);
  }

  const { data, error } = await svc.auth.admin.createUser({
    email: testEmail,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  userId = data.user.id;

  await svc.from("prompt_versions").upsert({
    id: "premortem_v1",
    kind: "premortem",
    file_path: "prompts/premortem_v1.md",
    content_hash: "e2e-test",
  });
});

test.afterAll(async () => {
  await svc.from("decisions").delete().eq("user_id", userId);
  await svc.from("prompt_versions").delete().eq("id", "premortem_v1");
  await svc.from("profiles").delete().eq("user_id", userId);
  await svc.auth.admin.deleteUser(userId);
});

test("core pages have no serious/critical axe violations", async ({ page }) => {
  await page.goto("/login");
  await assertNoSeriousViolations(page);

  const { data: link, error: linkError } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email: testEmail,
  });
  if (linkError || !link) throw linkError ?? new Error("generateLink returned nothing");

  await page.goto(
    `/auth/confirm?token_hash=${link.properties.hashed_token}&type=${link.properties.verification_type}&next=/decisions`,
  );
  await expect(page).toHaveURL(/\/decisions$/);

  await page.goto("/dashboard");
  await assertNoSeriousViolations(page);

  await page.goto("/decisions/new");
  await assertNoSeriousViolations(page);

  await page.getByLabel("Title").fill("Take the new job offer");
  await page.getByLabel("Context").fill("Weighing a role change with a relocation.");
  await page.locator('fieldset input[type="text"]').first().fill("Accept the offer");
  await page.getByRole("radio", { name: "Chosen option 1" }).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/decisions\/[^/]+\/edit$/);
  const decisionId = page.url().match(/\/decisions\/([^/]+)\/edit$/)![1];

  await page.getByLabel("Question").fill("Will I still be at the new job in a year?");
  await page.getByRole("button", { name: "Add forecast" }).click();
  await page.getByRole("button", { name: "Generate pre-mortem" }).click();
  await expect(page.getByText("e2e mock risk: launch has no owner once shipped")).toBeVisible();
  await assertNoSeriousViolations(page);

  await page.getByRole("button", { name: "Commit decision" }).click();
  await expect(page).toHaveURL(`/decisions/${decisionId}`);
  await assertNoSeriousViolations(page);

  const checkinHref = await page
    .locator(`a[href^="/decisions/${decisionId}/checkin/"]`)
    .first()
    .getAttribute("href");
  const checkinId = checkinHref!.split("/").pop()!;
  const forceDue = await page.request.post("/api/test/force-due", { data: { checkinId } });
  expect(forceDue.ok()).toBe(true);

  await page.goto(`/decisions/${decisionId}/checkin/${checkinId}`);
  await assertNoSeriousViolations(page);
});
