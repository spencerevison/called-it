import "./env";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// T36 — full core-flow smoke: sign in -> create decision -> forecast ->
// mocked pre-mortem -> commit -> force a check-in due -> complete it with
// one linked + one unlisted failure -> resolve. Ends on the decision detail
// page (dashboard is P8, out of scope here per the task AC).
//
// Needs `supabase start` (real local Postgres + auth) -- same prereq as
// `pnpm test:db`, not part of `pnpm check`/CI.

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const testEmail = "e2e-happy-path@example.com";
let userId: string;

test.beforeAll(async () => {
  // clean up a stale run before it left things half-deleted
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

  // premortems.prompt_version FKs to prompt_versions(id) -- the real registry
  // doesn't land until T37, so seed the row this flow needs directly (same
  // move db-tests/rls.test.ts already makes for its own prompt_version row).
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

test("happy path: create, commit, check in, resolve", async ({ page }) => {
  const { data: link, error: linkError } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email: testEmail,
  });
  if (linkError || !link) throw linkError ?? new Error("generateLink returned nothing");

  await page.goto(
    `/auth/confirm?token_hash=${link.properties.hashed_token}&type=${link.properties.verification_type}&next=/decisions`,
  );
  await expect(page).toHaveURL(/\/decisions$/);

  // --- create decision ---
  await page.goto("/decisions/new");
  await page.getByLabel("Title").fill("Take the new job offer");
  await page.getByLabel("Context").fill("Weighing a role change with a relocation.");
  const optionInputs = page.locator('fieldset input[type="text"]');
  await optionInputs.nth(0).fill("Accept the offer");
  await page.getByRole("button", { name: "Add option" }).click();
  await optionInputs.nth(1).fill("Stay put");
  await page.getByRole("radio", { name: "Chosen option 1" }).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/decisions\/[^/]+\/edit$/);
  const decisionId = page.url().match(/\/decisions\/([^/]+)\/edit$/)![1];

  // --- forecast ---
  await page.getByLabel("Question").fill("Will I still be at the new job in a year?");
  await page.getByRole("button", { name: "Add forecast" }).click();
  await expect(page.getByText("Will I still be at the new job in a year?")).toBeVisible();

  // --- mocked pre-mortem ---
  await page.getByRole("button", { name: "Generate pre-mortem" }).click();
  await expect(page.getByText("e2e mock risk: launch has no owner once shipped")).toBeVisible();

  // --- commit (defaults are fine) ---
  await page.getByRole("button", { name: "Commit decision" }).click();
  await expect(page).toHaveURL(`/decisions/${decisionId}`);

  // --- force the two-week check-in due (skips the real wait.until) ---
  const checkinHref = await page
    .locator(`a[href^="/decisions/${decisionId}/checkin/"]`)
    .first()
    .getAttribute("href");
  const checkinId = checkinHref!.split("/").pop()!;
  const forceDue = await page.request.post("/api/test/force-due", { data: { checkinId } });
  expect(forceDue.ok()).toBe(true);

  // --- complete the check-in ---
  await page.goto(`/decisions/${decisionId}/checkin/${checkinId}`);
  await page.getByLabel("Outcome notes").fill("Took the job, six months in now.");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.getByLabel(/what do you recall estimating/).fill("0.6");
  await page.getByRole("button", { name: "Reveal recorded value" }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  await expect(page.getByText(/resolved yes/)).toBeVisible();

  await page.getByLabel("What happened?").fill("Onboarding took longer than expected.");
  await page.locator("select").first().selectOption({ label: "e2e mock risk: launch has no owner once shipped" });
  await page.getByRole("button", { name: "Add failure" }).click();
  const linkedFailure = page.locator("li").filter({ hasText: "Onboarding took longer than expected." });
  await expect(linkedFailure).toContainText("linked: e2e mock risk: launch has no owner once shipped");
  await expect(linkedFailure).toContainText("skill");

  await page.getByLabel("What happened?").fill("A reorg nobody saw coming.");
  await page.getByRole("button", { name: "Add failure" }).click();
  const unlistedFailure = page.locator("li").filter({ hasText: "A reorg nobody saw coming." });
  await expect(unlistedFailure).toContainText("unlisted");

  await page.getByRole("button", { name: "Complete check-in" }).click();
  await expect(page.getByText("This check-in is complete.")).toBeVisible();
  await expect(linkedFailure).toContainText("linked: e2e mock risk: launch has no owner once shipped");

  // --- resolve ---
  await page.goto(`/decisions/${decisionId}`);
  await page.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText("resolved", { exact: true })).toBeVisible();
});
