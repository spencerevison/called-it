# TASKS — called-it

One task per loop iteration. Tags: `[risk:high|low|math]` = drives the review gate (mapping in `CLAUDE.md`) · `[E2E]` = Playwright gate also required · `[DEFER]` = deferred until every non-[DEFER] task is checked or blocked. ACs are binding; SPEC/companion docs govern anything unstated.

## P0 · Scaffold

- [x] T01 [risk:low]: Init Next.js 16 (App Router) — or newer current major at install time, per SPEC version policy + TypeScript strict + Tailwind + shadcn/ui, pnpm. — AC: `pnpm dev` boots; `pnpm check` script exists (typecheck && lint && vitest run) and passes; strict mode on, no `any` in template code; the full semantic token set from `DESIGN.md` is defined as CSS `@theme`/`:root` variables (Tailwind v4 is CSS-first — no JS theme config) with placeholder values (all UI from here on uses tokens only — DESIGN.md's hard convention is binding).
- [x] T02 [risk:low]: GitHub Actions CI running `pnpm check` on push/PR. — AC: workflow file present; passes on a clean clone (document node/pnpm versions).
- [x] T03 [risk:low]: Supabase client setup (server + browser helpers), `.env.example` with every var the project will need (Supabase, Anthropic, Trigger.dev, Langfuse, Resend placeholder), typegen script (`pnpm db:types`). — AC: helpers typed; no secrets committed.
- [x] T04 [risk:low]: Vitest config + example unit test; Playwright config + placeholder smoke (`pnpm test:e2e`). — AC: both runners green locally.

## P1 · Data model (per DATA_MODEL.md — normative)

- [x] T05 [risk:low]: Migration: all enums + `profiles`. — AC: migration applies cleanly to a fresh local db.
- [x] T06 [risk:low]: Migration: `decisions`, `decision_events` + indexes. — AC: constraints from DATA_MODEL enforced (checked via a throwaway insert test).
- [x] T07 [risk:low]: Migration: `forecasts` (incl. `resolved_in_checkin_id`, `recalled_at`, `revealed_at`; no interval-headroom columns) + probability check constraint + indexes. — AC: p=0.005 insert rejected; the `resolved_in_checkin_id` FK is added later in T09 (forecasts precedes checkins).
- [x] T08 [risk:low]: Migration: `premortems`, `premortem_risks` (category CHECK-constrained to the five values) + indexes. — AC: cascade delete verified; `premortems.prompt_version` FK is added in T10 (premortems precedes prompt_versions).
- [x] T09 [risk:low]: Migration: `checkins` (incl. `overall_attribution`, the completed-requires-attribution CHECK, and the `(decision_id, horizon) where horizon <> 'custom'` unique index), `checkin_failures` + indexes; add the deferred `forecasts.resolved_in_checkin_id` FK now that `checkins` exists. — AC: `linked_risk_id` FK nullable and enforced; completing a check-in without `overall_attribution` is rejected by the DB; an insert with a bogus `resolved_in_checkin_id` is rejected (proves the deferred FK was actually added).
- [x] T10 [risk:low]: Migration: `prompt_versions`, `judge_scores` (incl. `input_hash`), `eval_items`, `eval_runs`; add the deferred `premortems.prompt_version` FK now that `prompt_versions` exists. — AC: `judge_scores.prompt_version` and `premortems.prompt_version` FKs enforced.
- [x] T11 [risk:high]: RLS on all user tables: **select** policies where `user_id = auth.uid()`; **no authenticated insert/update/delete policies** (writes are service-role only, DATA_MODEL rule 0); `prompt_versions` read-authenticated; **eval tables `enable row level security` with zero policies** (deny-all, not RLS-disabled). — AC: policy tests in `pnpm test:db` (requires `supabase start`; documented; NOT part of `pnpm check`/CI) — anon reads zero rows; an authenticated user reads zero eval rows and **cannot write any user table directly** (insert/update via the anon+JWT client is rejected by RLS); user A cannot read user B's rows; the server-action layer rejects a child row whose parent belongs to another user or another decision.
- [x] T12 [risk:low]: Seed script: dataset matching METRICS.md §Aggregation-contract minimums; header comment documents every hand-computed metric value for the seed. — AC: `pnpm db:seed` idempotent.

## P2 · Metrics library (pure functions; METRICS.md is normative)

- [x] T13 [risk:math]: Metrics library — all ten metrics (M1–M10) as pure functions in `src/lib/metrics/`, TDD. Transcribe every METRICS.md test vector (including empty/edge cases) **verbatim** into `*.test.ts` first, then implement to green — do not invent expected values. Honor the normative details: null (not NaN) on empty input; M5 multiple-of checks on integer basis points (`Math.round(p*10000) % 1000 === 0` etc.); M6 excludes 31–90d forecasts; M9 tie-valence = bad; M10 per-failure primary + per-decision companion; functions return the raw value + n (min-n gating lives in T20, not here). — AC: `pnpm check` green; every M1–M10 vector value equals METRICS.md exactly.
- [x] T20 [risk:math] (deps: T13): Aggregation service `getDashboardMetrics`: data access behind an injected row-fetcher interface → pure functions; wire min-n rules (M9 valence groups forecasts by `resolved_in_checkin_id`). — AC: unit tests feed the T12 seed dataset as in-memory fixtures and equal the seed-header hand-computed values exactly (no DB in `pnpm check`); the thin Supabase-backed fetcher is exercised by `pnpm test:db`.

> **QUALITY GATE — P2:** Fable reviews the cumulative diff since the last gate for coherence, dead code, duplication, and over-engineering. Batched, read-only, written finding. (Details: CLAUDE.md.)

## P3 · Core flows

*(All UI tasks from here on follow `DESIGN.md`. While its Direction section is TODO: neutral shadcn through semantic tokens, structure and hierarchy over identity, no invented visual flourish.)*

- [x] T21 [risk:high]: Supabase Auth (magic link), protected app layout, sign-out. — AC: unauthenticated visit to app routes redirects; session persists reload. (The `next` redirect param must reject off-site targets — see docs/EVIDENCE.md for the historical bypass class.)
- [x] T22 [risk:low]: Decision create/edit (draft): title, context, rationale, options (dynamic list, min 1), chosen option (one of the options), stakes, reversibility. — AC: draft persists; `chosen_option` stored; validation messages accessible (label/`aria-describedby`).
- [x] T23 [risk:low]: Forecast add/edit on a **draft** decision: question, probability slider+input (0.01–0.99), desired toggle, resolve-by. (Judge-input fields freeze at commit — active decisions only *resolve* forecasts, at check-ins; adding/editing forecasts on an active decision is out of v1, parking-lot.) — AC: stored as numeric; desired defaults true; add/edit blocked once the decision is active.
- [x] T24 [risk:high]: Pre-mortem generation server action: template loader renders `prompts/premortem_v1.md` with decision fields (`horizon_months` = 6, the final check-in horizon); Anthropic call; parse/validate JSON; persist premortem + risks (source=ai) with prompt_version + Langfuse trace id. — AC: fully mocked unit tests incl. malformed-JSON retry-once-then-error path; live path behind env key.
- [x] T25 [risk:high]: Pre-mortem review UI: risk list grouped by category with severity badges; add-own-risk (source=user, **draft only** — risks are judge input, frozen at commit); regenerate allowed on draft only. — AC: user risks persist and render distinctly; add-own-risk blocked once active; ownership verified before insert (historical IDOR — docs/EVIDENCE.md).
- [x] T26 [risk:high]: Commit action: draft→active transition per DATA_MODEL integrity rule 1 (decided_at, `committed` event, three check-in rows at 2w/2m/6m with edit-before-confirm; judge-input fields become immutable — revise/reverse/reaffirm are annotation events, never field edits). — AC: transactional — partial failure leaves draft untouched; post-commit edits to frozen fields rejected at the action layer.
- [x] T27 [risk:low]: Decision list (status filters) + decision detail page composing entry, forecasts, pre-mortem, check-in timeline. Recorded probabilities are **hidden for unresolved forecasts** (shown only after resolution) so a later recalled-probability capture stays honest (M3 integrity). — AC: empty states designed, not blank; recorded p is not in the DOM for unresolved forecasts.
- [x] T28 [risk:low]: Decision events UI: revise (payload diff note) / reverse / reaffirm actions writing `decision_events`. — AC: events render as a timeline; reverse prompts for a one-line reason.

> **QUALITY GATE — P3:** Fable reviews the cumulative diff since the last gate. (Details: CLAUDE.md.)

## P4 · Scheduling

- [x] T29 [risk:high]: Trigger.dev setup (verify current SDK major against docs before scaffolding; note the version in PROGRESS) + `checkinReminder(checkinId)` task using `wait.until({ date: scheduled_for })`; on wake re-fetch row and self-noop unless `status=pending` AND the row's `trigger_run_id` matches this run (guards early-fire on reschedule); else set status=due; store run id on the row. — AC: unit-tested via extracted handler logic with mocked client; task file matches the current Trigger.dev SDK API. — WATCH: fat task; run whole at the raised turn cap, split only on capability failure (not turn-budget failure).
- [x] T30 [risk:high]: Daily reconciliation cron task: `pending` rows with `scheduled_for < now()` → due. — AC: idempotent; covered by handler-logic test.
- [x] T31 [risk:low]: Due inbox: app-wide badge count + `/due` list linking into check-in flow. — AC: count matches due rows; empty state present.
- [ ] T32 [DEFER] [risk:high]: Email notification on due (Resend), one per transition. — AC: template renders decision title + link; no duplicate sends on cron re-runs.

> **QUALITY GATE — P4:** Fable reviews the cumulative diff since the last gate. (Details: CLAUDE.md.)

## P5 · Check-in

- [x] T33 [risk:high]: Check-in flow step 1–2: outcome notes; then per open forecast — recalled-probability capture **before** the recorded value exists anywhere in the response payload/DOM, then reveal recorded + capture outcome (yes/no/can't-resolve-yet). — AC: an integration test asserts the recalled-step server response excludes recorded probabilities; recall is write-once (rejected once `revealed_at` is set) and revealing sets `revealed_at`; resolving a forecast sets `resolved`, `outcome`, `resolved_at`, and `resolved_in_checkin_id` = this check-in (M9's valence link); DATA_MODEL integrity rule 2 enforced.
- [x] T34 [risk:high]: Check-in flow step 3–4: failures (description, was_knowable, link to a pre-mortem risk via picker or "unlisted", attribution per failure); required `overall_attribution`; complete check-in. — AC: completing without overall_attribution blocked; links persist; a `linked_risk_id` must belong to the same decision as the check-in (DATA_MODEL rule 4) — a cross-decision link is rejected by the action.
- [x] T35 [risk:high]: Resolution: from any check-in (or decision page), mark decision resolved/abandoned → `resolved_at`, terminal event, remaining pending/due check-ins set to skipped (DATA_MODEL rule 5). — AC: skipped check-ins never turn due (T29/T30 respect terminal states).
- [x] T36 [E2E] [risk:low]: Playwright happy path: sign in (test helper) → create decision → forecasts → mocked pre-mortem → commit → test hook forces a check-in due → complete check-in with one linked + one unlisted failure → resolve; assert final state on the decision detail page (status=resolved, failure links + attribution present). — AC: runs headless locally with mocked LLM; < 90s; ends at the decision detail page — the dashboard is P8, so this stays a core-flow smoke and does NOT assert dashboard state (dashboard correctness is covered by T20's aggregation integration test against the seed + T46–T49 render tests; no full-stack E2E through P8 is needed); e2e-in-CI is a [DEFER] follow-up (needs DB + app services in CI — do not block on it).

> **QUALITY GATE — P5:** Fable reviews the cumulative diff since the last gate. (Details: CLAUDE.md.)

## P6 · Judge

- [ ] T37 [risk:low]: Prompt registry: parse `prompts/*.md` frontmatter-ish headers, register into `prompt_versions` with content hash at startup/build; drift (file vs hash) fails loudly. — AC: unit tests for parse + drift detection.
- [ ] T38 [risk:high]: Judge server action at commit: assemble outcome-blind input per DATA_MODEL integrity rule 3 (assertion test greps payload for outcome-field names), call judge_v1, validate JSON, persist judge_scores (incl. `input_hash` = hash of the assembled input) + Langfuse trace. — AC: mocked tests incl. contamination=true logging path; a test asserts the stored input_hash matches a re-hash of the asserted-outcome-free payload. — WATCH: fat task; run whole at the raised turn cap, split only on capability failure (not turn-budget failure).
- [ ] T39 [risk:low]: Judge display on decision detail: three scores with anchor tooltips, per-dimension rationale, evidence spans, "experimental" badge gated by an env/config flag (flipped when EVAL_PLAN §4 bar is met). — AC: badge copy explains why, in one sentence.

> **QUALITY GATE — P6:** Fable reviews the cumulative diff since the last gate. (Details: CLAUDE.md.)

## P7 · Eval harness (EVAL_PLAN.md is normative)

*(Eval CLIs separate computation from persistence behind an injected store interface with in-memory and Supabase implementations. Smoke and unit tests use the in-memory store — no DB, no live API.)*

- [ ] T40 [risk:low]: `pnpm eval:import` — validate goldset/*.json against the schema (zod), load into eval_items; clear errors with file+path. — AC: example-001 and fixtures import (schema ignores keys prefixed with `_`, e.g. `_note`); a deliberately broken fixture fails with a useful message.
- [ ] T41 [risk:high]: `pnpm eval:judge --version <v>` — outcome-blind judging of eval items, agreement math (within1/exact/MAE per dimension + macro), disagreement-case detail (both rationales) to stdout + gitignored `docs/eval/detail/`, committed report (aggregate metrics + item ids ONLY — EVAL_PLAN privacy rule) to `docs/eval/`, `eval_runs` row. — AC: agreement math unit-tested on a small hand-computed fixture set (3 items → known within1/MAE); a test asserts the committed report contains no `decision`/`rationale` content from items.
- [ ] T42 [risk:low]: `pnpm eval:premortem --version <v>` — generate per item, assisted-manual matching CLI (persisted matches keyed per EVAL_PLAN §2), surface-rate report + `eval_runs` row. — AC: matching session resumable; re-run same version reuses matches without prompting.
- [ ] T43 [risk:low]: `pnpm eval:compare --kind premortem v1 v2` — delta table (surface rate, mean risks, cost/item, p50 latency from Langfuse) → report + `eval_runs`. — AC: renders with mocked Langfuse data in tests.
- [ ] T44 [risk:low]: CI eval smoke: 3 fixtures + deterministic mocked LLM through import→judge→report. — AC: separate `pnpm eval:smoke` script + CI job (not part of `pnpm check`); runs against the in-memory store; zero live calls (assert fetch-mock).
- [ ] T45 [DEFER] [risk:low]: `pnpm eval:contamination` — outcome-aware judge variant prompt (derived from judge_v1 + outcome section) vs blind, per EVAL_PLAN; delta-by-outcome-valence report. — AC: variant prompt committed as `prompts/judge_v1_aware.md`, excluded from the in-app registry.

> **QUALITY GATE — P7:** Fable reviews the cumulative diff since the last gate. (Details: CLAUDE.md.)

## P8 · Dashboard

- [ ] T46 [risk:low] (deps: T20): Dashboard shell: summary cards (decisions, resolved, open check-ins, Brier headline) with min-n states. — AC: matches seed hand-values.
- [ ] T47 [risk:low] (deps: T20): Calibration curve chart (perfect-calibration diagonal, bin dots sized by n, n<5 greyed) + Brier trend (rolling). — AC: renders from seed; keyboard-focusable tooltips.
- [ ] T48 [risk:low] (deps: T20): Bias panel: hindsight (M3), optimism (M4 with control line), self-serving (M9) — each with its plain-language sentence per METRICS.md display rule. — AC: sentences render with live values interpolated; min-n fallbacks.
- [ ] T49 [risk:low] (deps: T20): Behavior panel: granularity (M5), horizon gap (M6), options count (M7), reversal (M8), surface rate (M10). — AC: same display-rule compliance.
- [ ] T50 [risk:low]: Dashboard empty/threshold states: a new user sees what will unlock and at what n, not a wall of "insufficient data." — AC: copy reviewed against SPEC G2 intent.

## P9 · Ship

- [ ] T51 [risk:low]: README: what/why, architecture + the four ADRs summarized, eval methodology + the eval table (from eval_runs), metrics glossary (one line each), honest build note ("built with Claude Code against a written spec; hand-verified: the METRICS.md test vectors and the eval gold-set labels"), local setup. — AC: a stranger can run it locally from the README alone.
- [ ] T52 [risk:low]: A11y + polish pass on all forms/flows: labels, focus order, error announcements; visual pass against frontend-design baseline. — AC: axe run on core pages clean of serious/critical.
- [ ] T53 [risk:high]: Vercel deploy (envs documented), Trigger.dev deployed, Langfuse verified in prod. — AC: production URL live end-to-end with a real decision entry.
- [ ] T54 [DEFER] [risk:low]: Record the 60s demo per EVAL_PLAN §6. — AC: link in README.
