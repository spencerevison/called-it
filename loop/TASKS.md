# TASKS — called-it

One task per loop iteration. Tags: `[HAND]` = Spence implements (loop stubs + tests only) · `[E2E]` = Playwright gate also required · `[DEFER]` = deferred until every non-[DEFER], non-[HAND] task is checked or blocked. ACs are binding; SPEC/companion docs govern anything unstated.

## P0 · Scaffold

- [ ] T01: Init Next.js 16 (App Router) — or newer current major at install time, per SPEC version policy + TypeScript strict + Tailwind + shadcn/ui, pnpm. — AC: `pnpm dev` boots; `pnpm check` script exists (typecheck && lint && vitest run) and passes; strict mode on, no `any` in template code; the full semantic token set from `DESIGN.md` is defined as CSS `@theme`/`:root` variables (Tailwind v4 is CSS-first — no JS theme config) with placeholder values (all UI from here on uses tokens only — DESIGN.md's hard convention is binding).
- [ ] T02: GitHub Actions CI running `pnpm check` on push/PR. — AC: workflow file present; passes on a clean clone (document node/pnpm versions).
- [ ] T03: Supabase client setup (server + browser helpers), `.env.example` with every var the project will need (Supabase, Anthropic, Trigger.dev, Langfuse, Resend placeholder), typegen script (`pnpm db:types`). — AC: helpers typed; no secrets committed.
- [ ] T04: Vitest config + example unit test; Playwright config + placeholder smoke (`pnpm test:e2e`). — AC: both runners green locally.

## P1 · Data model (per DATA_MODEL.md — normative)

- [ ] T05: Migration: all enums + `profiles`. — AC: migration applies cleanly to a fresh local db.
- [ ] T06: Migration: `decisions`, `decision_events` + indexes. — AC: constraints from DATA_MODEL enforced (checked via a throwaway insert test).
- [ ] T07: Migration: `forecasts` + probability check constraint + indexes. — AC: p=0.005 insert rejected.
- [ ] T08: Migration: `premortems`, `premortem_risks` + indexes. — AC: cascade delete verified.
- [ ] T09: Migration: `checkins` (incl. `overall_attribution`), `checkin_failures` + indexes. — AC: `linked_risk_id` FK nullable and enforced.
- [ ] T10: Migration: `prompt_versions`, `judge_scores`, `eval_items`, `eval_runs`. — AC: `judge_scores.prompt_version` FK enforced.
- [ ] T11: RLS on all user tables (select/insert/update/delete, `user_id = auth.uid()` + with-check); `prompt_versions` read-authenticated; eval tables service-role only. — AC: policy tests in `pnpm test:db` (requires `supabase start`; documented; NOT part of `pnpm check`/CI) — anon reads zero rows; user A cannot read user B's rows; authenticated insert with mismatched user_id rejected.
- [ ] T12: Seed script: dataset matching METRICS.md §Aggregation-contract minimums; header comment documents every hand-computed metric value for the seed. — AC: `pnpm db:seed` idempotent.

## P2 · Metrics library (pure functions; METRICS.md is normative)

- [ ] T13: Transcribe **all** METRICS.md test vectors (M1–M10, including empty-input cases) into `src/lib/metrics/*.test.ts`, verbatim expected values; create typed function signatures for all ten metrics; stub `[HAND]` implementations (M1, M2, M10) with `throw new Error("HAND: not yet implemented")` ; their specs live in `*.hand.test.ts` files excluded from the default vitest config and run by a second config via `pnpm test:hand` (this file-split is the sanctioned mechanism — not a skipped test, no gate-rule violation). — AC: `pnpm check` green; `pnpm test:hand` runs exactly the HAND specs and fails.
- [ ] T14 [HAND]: Implement M1 Brier + rolling Brier. — AC: `pnpm test:hand` M1 specs green.
- [ ] T15 [HAND]: Implement M2 calibration-curve binning. — AC: M2 specs green, boundary values land per bin definition.
- [ ] T16: Implement M3 hindsight + M4 optimism coefficients. — AC: vectors green; null (not NaN) below min-n handled at aggregation layer, functions return raw values + n.
- [ ] T17: Implement M5 granularity + M6 horizon gap + M7 options count. — AC: vectors green; M6 excludes 31–90d forecasts.
- [ ] T18: Implement M8 reversal frequency + M9 self-serving index. — AC: vectors green; M9 tie-valence = bad verified.
- [ ] T19 [HAND]: Implement M10 surface rate (per-failure primary + per-decision companion). — AC: both vector values green; unknowable failures excluded.
- [ ] T20 (deps: T14, T15, T19): Aggregation service `getDashboardMetrics`: data access behind an injected row-fetcher interface → pure functions; wire min-n rules. — AC: unit tests feed the T12 seed dataset as in-memory fixtures and equal the seed-header hand-computed values exactly (no DB in `pnpm check`); the thin Supabase-backed fetcher is exercised by `pnpm test:db`.

## P3 · Core flows

*(All UI tasks from here on follow `DESIGN.md`. While its Direction section is TODO: neutral shadcn through semantic tokens, structure and hierarchy over identity, no invented visual flourish.)*

- [ ] T21: Supabase Auth (magic link), protected app layout, sign-out. — AC: unauthenticated visit to app routes redirects; session persists reload.
- [ ] T22: Decision create/edit (draft): title, context, rationale, options (dynamic list, min 1), chosen option (one of the options), stakes, reversibility. — AC: draft persists; `chosen_option` stored; validation messages accessible (label/`aria-describedby`).
- [ ] T23: Forecast add/edit on a draft/active decision: question, probability slider+input (0.01–0.99), desired toggle, resolve-by. — AC: stored as numeric; desired defaults true.
- [ ] T24: Pre-mortem generation server action: template loader renders `prompts/premortem_v1.md` with decision fields (`horizon_months` = 6, the final check-in horizon); Anthropic call; parse/validate JSON; persist premortem + risks (source=ai) with prompt_version + Langfuse trace id. — AC: fully mocked unit tests incl. malformed-JSON retry-once-then-error path; live path behind env key.
- [ ] T25: Pre-mortem review UI: risk list grouped by category with severity badges; add-own-risk (source=user); regenerate allowed on draft only. — AC: user risks persist and render distinctly.
- [ ] T26: Commit action: draft→active transition per DATA_MODEL integrity rule 1 (decided_at, `committed` event, three check-in rows at 2w/2m/6m with edit-before-confirm, decision-time fields frozen). — AC: transactional — partial failure leaves draft untouched; post-commit edit attempts rejected at the action layer.
- [ ] T27: Decision list (status filters) + decision detail page composing entry, forecasts, pre-mortem, check-in timeline. — AC: empty states designed, not blank.
- [ ] T28: Decision events UI: revise (payload diff note) / reverse / reaffirm actions writing `decision_events`. — AC: events render as a timeline; reverse prompts for a one-line reason.

## P4 · Scheduling

- [ ] T29: Trigger.dev setup (verify current SDK major against docs before scaffolding; note the version in PROGRESS) + `checkinReminder(checkinId)` task using `wait.until({ date: scheduled_for })`; on wake re-fetch row and self-noop unless status=pending; else set status=due; store run id on the row. — AC: unit-tested via extracted handler logic with mocked client; task file matches the current Trigger.dev SDK API.
- [ ] T30: Daily reconciliation cron task: `pending` rows with `scheduled_for < now()` → due. — AC: idempotent; covered by handler-logic test.
- [ ] T31: Due inbox: app-wide badge count + `/due` list linking into check-in flow. — AC: count matches due rows; empty state present.
- [ ] T32 [DEFER]: Email notification on due (Resend), one per transition. — AC: template renders decision title + link; no duplicate sends on cron re-runs.

## P5 · Check-in

- [ ] T33: Check-in flow step 1–2: outcome notes; then per open forecast — recalled-probability capture **before** the recorded value exists anywhere in the response payload/DOM, then reveal recorded + capture outcome (yes/no/can't-resolve-yet). — AC: an integration test asserts the recalled-step server response excludes recorded probabilities; DATA_MODEL integrity rule 2 enforced.
- [ ] T34: Check-in flow step 3–4: failures (description, was_knowable, link to a pre-mortem risk via picker or "unlisted", attribution per failure); required `overall_attribution`; complete check-in. — AC: completing without overall_attribution blocked; links persist.
- [ ] T35: Resolution: from any check-in (or decision page), mark decision resolved/abandoned → `resolved_at`, terminal event, remaining check-ins skipped. — AC: skipped check-ins never turn due (T29/T30 respect terminal states).
- [ ] T36 [E2E]: Playwright happy path: sign in (test helper) → create decision → forecasts → mocked pre-mortem → commit → test hook forces a check-in due → complete check-in with one linked + one unlisted failure → resolve; assert final state on the decision detail page (status=resolved, failure links + attribution present). — AC: runs headless locally with mocked LLM; < 90s; ends at the decision detail page — the dashboard is P8, so this stays a core-flow smoke and does NOT assert dashboard state (dashboard correctness is covered by T20's aggregation integration test against the seed + T46–T49 render tests; no full-stack E2E through P8 is needed); e2e-in-CI is a [DEFER] follow-up (needs DB + app services in CI — do not block on it).

## P6 · Judge

- [ ] T37: Prompt registry: parse `prompts/*.md` frontmatter-ish headers, register into `prompt_versions` with content hash at startup/build; drift (file vs hash) fails loudly. — AC: unit tests for parse + drift detection.
- [ ] T38: Judge server action at commit: assemble outcome-blind input per DATA_MODEL integrity rule 3 (assertion test greps payload for outcome-field names), call judge_v1, validate JSON, persist judge_scores + Langfuse trace. — AC: mocked tests incl. contamination=true logging path.
- [ ] T39: Judge display on decision detail: three scores with anchor tooltips, per-dimension rationale, evidence spans, "experimental" badge gated by an env/config flag (flipped when EVAL_PLAN §4 bar is met). — AC: badge copy explains why, in one sentence.

## P7 · Eval harness (EVAL_PLAN.md is normative)

*(Eval CLIs separate computation from persistence behind an injected store interface with in-memory and Supabase implementations. Smoke and unit tests use the in-memory store — no DB, no live API.)*

- [ ] T40: `pnpm eval:import` — validate goldset/*.json against the schema (zod), load into eval_items; clear errors with file+path. — AC: example-001 and fixtures import (schema ignores keys prefixed with `_`, e.g. `_note`); a deliberately broken fixture fails with a useful message.
- [ ] T41: `pnpm eval:judge --version <v>` — outcome-blind judging of eval items, agreement math (within1/exact/MAE per dimension + macro), disagreement-case detail (both rationales) to stdout + gitignored `docs/eval/detail/`, committed report (aggregate metrics + item ids ONLY — EVAL_PLAN privacy rule) to `docs/eval/`, `eval_runs` row. — AC: agreement math unit-tested on a small hand-computed fixture set (3 items → known within1/MAE); a test asserts the committed report contains no `decision`/`rationale` content from items.
- [ ] T42: `pnpm eval:premortem --version <v>` — generate per item, assisted-manual matching CLI (persisted matches keyed per EVAL_PLAN §2), surface-rate report + `eval_runs` row. — AC: matching session resumable; re-run same version reuses matches without prompting.
- [ ] T43: `pnpm eval:compare --kind premortem v1 v2` — delta table (surface rate, mean risks, cost/item, p50 latency from Langfuse) → report + `eval_runs`. — AC: renders with mocked Langfuse data in tests.
- [ ] T44: CI eval smoke: 3 fixtures + deterministic mocked LLM through import→judge→report. — AC: separate `pnpm eval:smoke` script + CI job (not part of `pnpm check`); runs against the in-memory store; zero live calls (assert fetch-mock).
- [ ] T45 [DEFER]: `pnpm eval:contamination` — outcome-aware judge variant prompt (derived from judge_v1 + outcome section) vs blind, per EVAL_PLAN; delta-by-outcome-valence report. — AC: variant prompt committed as `prompts/judge_v1_aware.md`, excluded from the in-app registry.

## P8 · Dashboard

- [ ] T46 (deps: T20): Dashboard shell: summary cards (decisions, resolved, open check-ins, Brier headline) with min-n states. — AC: matches seed hand-values.
- [ ] T47 (deps: T20): Calibration curve chart (perfect-calibration diagonal, bin dots sized by n, n<5 greyed) + Brier trend (rolling). — AC: renders from seed; keyboard-focusable tooltips.
- [ ] T48 (deps: T20): Bias panel: hindsight (M3), optimism (M4 with control line), self-serving (M9) — each with its plain-language sentence per METRICS.md display rule. — AC: sentences render with live values interpolated; min-n fallbacks.
- [ ] T49 (deps: T20): Behavior panel: granularity (M5), horizon gap (M6), options count (M7), reversal (M8), surface rate (M10). — AC: same display-rule compliance.
- [ ] T50: Dashboard empty/threshold states: a new user sees what will unlock and at what n, not a wall of "insufficient data." — AC: copy reviewed against SPEC G2 intent.

## P9 · Ship

- [ ] T51: README: what/why, architecture + the four ADRs summarized, eval methodology + the eval table (from eval_runs), metrics glossary (one line each), honest build note ("built with Claude Code against a written spec; hand-authored: Brier, calibration binning, surface rate; eval labels hand-written"), local setup. — AC: a stranger can run it locally from the README alone.
- [ ] T52: A11y + polish pass on all forms/flows: labels, focus order, error announcements; visual pass against frontend-design baseline. — AC: axe run on core pages clean of serious/critical.
- [ ] T53: Vercel deploy (envs documented), Trigger.dev deployed, Langfuse verified in prod. — AC: production URL live end-to-end with a real decision entry.
- [ ] T54 [DEFER]: Record the 60s demo per EVAL_PLAN §6. — AC: link in README.
