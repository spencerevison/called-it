# Called It — Product Spec

**Name:** Called It (repo: `called-it`) — named for the claim the tool exists to test
**Status:** Approved for build · **Owner:** Spencer Campbell · **Date:** 2026-07-01
**Role in job search:** Portfolio Project 2 (absorbs the Project 3 AI-signal slot per plan v3)
**Companion docs:** `DATA_MODEL.md` · `METRICS.md` · `JUDGE_RUBRIC.md` · `EVAL_PLAN.md` · `DESIGN.md` · `prompts/` · `loop/`

---

## 1. One-liner

**Called It** — a personal decision journal that generates an LLM pre-mortem at decision time, records calibrated probability forecasts, wakes up on a durable schedule to run retrospectives, and scores decision **process** separately from **outcome** — with an eval harness that proves the LLM judge actually works.

## 2. Problem

People (Spence included) judge past decisions by how they turned out — "resulting," in Annie Duke's term — and never find out whether their confidence is calibrated, whether they consider enough options, or whether their pre-decision risk analysis surfaces the failures that actually happen. Existing tools cover fragments (Fatebook: Brier scoring, no LLM, maintenance mode; Mindsera: LLM journaling, no calibration or scheduled retrospective; Decision Journal app: pre-LLM). Per the June 2026 competitive validation, **no funded product ships the full combination**: LLM pre-mortem + recorded confidence + scheduled retrospective + LLM-as-judge process scoring + calibration tracking.

Two audiences, both real:

1. **Spence as user** — genuinely useful for his own decisions (validated: "felt like something genuinely useful to my life").
2. **Hiring managers at Series B–D product companies** — the eval methodology (gold set, judge validation, prompt A/B with measured deltas, cost/latency tracking) is the load-bearing hiring signal. This is what separates the project from a journaling toy.

## 3. Goals

- **G1 (user):** Logging a decision with forecasts and a pre-mortem takes < 10 minutes; a check-in takes < 5.
- **G2 (user):** After ~10 resolved decisions, the dashboard shows at least one non-obvious, personally actionable pattern (e.g., "overconfident on desired outcomes by 14 points").
- **G3 (portfolio):** LLM judge reaches **≥ 80% within-1 agreement** with human labels on the gold set (per dimension) before its scores are surfaced as trustworthy — and the iteration to get there is visible in commits and the README.
- **G4 (portfolio):** At least one **prompt A/B with a measured delta** (pre-mortem surface rate v1 vs v2) published in the README.
- **G5 (portfolio):** Deployed on Vercel, real data in use, 60-second demo recordable per the demo script.

## 4. Non-Goals (v1)

- **Teams / sharing / multi-user collaboration.** Single-tenant personal tool; RLS keeps it multi-user-*ready*, nothing more. (Complexity without hiring signal.)
- **Recommendation engine.** The tool never tells the user what to decide. It scores process and calibration. (Different product; liability magnet; dilutes the wedge.)
- **Interval/numeric forecasts.** Binary probability forecasts only in v1; schema leaves room (P2). (Brier is the anchor metric; intervals double the metrics surface.)
- **Local models.** Cloud LLM + encryption at rest, tradeoff documented (ADR-2). (The hiring signal is that the tradeoff was reasoned about, not that a local model runs.)
- **Mobile app, integrations (Notion/Obsidian), payments.** (Out of MVP scope entirely.)
- **Kill criteria alerts / decision reminders beyond scheduled check-ins.** Parking lot.

## 5. User & Stories

Single persona: a reflective IC professional logging 2–5 meaningful decisions/month. (Concretely: Spence.)

- As a user, I want to log a decision with the options I considered and my rationale, so my decision-time reasoning is on record before the outcome contaminates it.
- As a user, I want to attach probability forecasts to concrete outcomes, so my calibration is measurable rather than vibes.
- As a user, I want an AI pre-mortem that surfaces specific failure modes I haven't considered, so I can address or accept them before committing.
- As a user, I want check-ins to find me at 2 weeks / 2 months / 6 months without my remembering, so retrospectives actually happen.
- As a user, I want to record what went wrong and link each failure to a pre-mortem risk (or mark it unlisted), so the system can measure whether pre-mortems are earning their keep.
- As a user, I want to state what probability I *remember* giving before seeing what I recorded, so my hindsight bias is measurable.
- As a user, I want the judge to score my process blind to the outcome, so a good outcome can't launder a bad process (and vice versa).
- As a user, I want a dashboard of hard metrics with plain-language interpretations, so patterns are legible without me doing statistics.

## 6. Core Loop

```
Log decision (title, context, options, chosen, stakes, reversibility, rationale)
  → Add forecasts (binary question, probability, desired?, resolve-by)
  → Generate pre-mortem (LLM; review; add own risks)
  → Commit  ──────────────► Judge scores process (outcome-blind)
  → Durable check-ins scheduled (2w / 2m / 6m, editable)
  → Check-in: recalled-probability capture → reveal recorded → resolve forecasts
      → record failures → link failures to pre-mortem risks → attribute luck/skill
  → Resolve or continue → Dashboard aggregates metrics
```

## 7. Requirements

### P0 — Must have (cannot ship without)

| # | Area | Requirement | Acceptance criteria (summary — task-level ACs in `loop/TASKS.md`) |
|---|------|-------------|------|
| F1 | Decisions | CRUD for decisions with options-considered (list), stakes, reversibility, rationale; statuses `draft → active → resolved/abandoned`; event log (revise/reverse/reaffirm) | Given a draft, when committed, then status=active, `decided_at` set, check-ins scheduled, decision becomes append-only except via logged events |
| F2 | Forecasts | Binary probability forecasts (question, p ∈ [0.01, 0.99], desired flag, resolve-by); resolution at check-in; recalled-probability captured **before** recorded value is revealed | Given an unresolved forecast at check-in, when the user opens it, then the recalled-p prompt renders before recorded p is anywhere in the DOM |
| F3 | Pre-mortem | One-click generation from decision-time fields via `prompts/premortem_v*.md`; risks stored as rows (category, severity, likelihood, source=ai); user can add own risks (source=user); Langfuse-traced | Given a decision with ≥ 2 options, when generated, then 6–12 distinct risks persist with a `prompt_version` and trace id; generation is mocked in tests |
| F4 | Scheduling | Durable check-ins at 2w/2m/6m (editable at commit) via Trigger.dev `wait.until`; DB row is source of truth; task self-noops if row no longer pending; daily reconciliation cron marks overdue rows due; in-app "due" inbox | Given a check-in row deleted after scheduling, when the task wakes, then nothing happens; given a missed task, when the daily cron runs, then the row is marked due |
| F5 | Check-in | Flow: outcome notes → recalled-p per open forecast → reveal + resolve → failures (each linked to a pre-mortem risk or "unlisted") → luck/skill/mixed attribution per failure → optional final resolution | Given a completed check-in with 2 failures, then each failure has an attribution and a link target (risk id or unlisted) |
| F6 | Judge | Outcome-blind LLM judge scores 3 rubric dimensions (see `JUDGE_RUBRIC.md`) on decision-time artifacts only; strict JSON output; prompt files are source of truth, registered in `prompt_versions`; scores hidden behind "experimental" label until eval bar (G3) is met | Given a judge call, then the assembled input contains no outcome/check-in fields (assertion test), and output validates against the JSON schema |
| F7 | Metrics | All metrics in `METRICS.md` implemented as pure functions with the documented test vectors; dashboard shows: calibration curve, Brier trend, horizon gap, hindsight/optimism/self-serving panel, granularity, options count, reversal frequency, pre-mortem surface rate — each with a one-line plain-language interpretation | Given the seed dataset, every dashboard metric equals the hand-computed value documented in the seed-file header (per `METRICS.md` §Aggregation contract), rendering "insufficient data" where the seed is below a metric's min-n (M3/M4/M6/M9); the `METRICS.md` M1–M10 test vectors are separate input arrays, unit-tested in T13 (not reproduced by the seed) |
| F8 | Eval harness | Gold-set import (`goldset/*.json`); `pnpm eval:judge` (agreement: within-1 %, exact %, MAE per dimension); `pnpm eval:premortem` (surface rate); `pnpm eval:compare` (A/B delta table); runs persisted to `eval_runs`; markdown report output; CI runs a 3-fixture mocked smoke | Given gold set n ≥ 20 and two prompt versions, when compare runs, then a delta table is produced and persisted |
| F9 | Auth/infra | Supabase Auth (magic link), RLS on all user tables, `.env.example`, GitHub Actions CI (`pnpm check` = typecheck + lint + unit tests), Vercel deploy | Given anon credentials, then no user rows are readable (policy test) |

### P1 — Nice to have (fast follows — tagged `[DEFER]` in loop/TASKS.md)

- Email notification for due check-ins (Resend).
- Contamination experiment: outcome-aware judge variant vs blind on the gold set; publish the measured resulting-susceptibility delta (README material — high signal, low cost).
- Trigger.dev task cancellation on reschedule (v1: self-noop is sufficient).
- Automated risk↔failure matching for the eval harness (v1: assisted-manual via CLI).

### P2 — Future considerations (design must not preclude)

- Interval forecasts (schema already carries nullable bounds + type).
- Murphy decomposition of Brier (reliability/resolution/uncertainty).
- Multi-user (RLS already enforces isolation).
- Export (decisions are plain rows; no lock-in formats).

## 8. Architecture

**Stack:** Next.js 16 (App Router) · TypeScript strict · Tailwind + shadcn/ui · Supabase (Postgres, Auth, RLS) · Trigger.dev · Anthropic API (Sonnet 5; note it rejects sampling-param overrides, so judge consistency comes from the anchored rubric + strict schema) · Langfuse (traces, cost, latency, tagged by `prompt_version`) · Vitest + Playwright · GitHub Actions · pnpm · Vercel.

**Version policy:** latest stable major for every dependency at install time; the loop verifies against current docs rather than trusting version numbers in this spec (which reflect its authoring date). Pins require a stated reason.

Rationale in one line: maximally overlapping with NSI-portal so every architecture question in an interview lands on ground Spence already owns; the only new surface is Trigger.dev, which is itself demo material.

### ADR-1: Scheduling — Trigger.dev durable waits vs cron-polling only

- **Options:** (A) Trigger.dev `wait.until` per check-in + daily reconciliation cron. (B) Vercel cron polling a `scheduled_for` index. (C) Inngest.
- **Decision:** A. Durable multi-month waits are the demo's money shot (a visibly running 6-month task) and exercise a real production pattern (durable execution). B alone is simpler and is retained *inside* A as the reconciliation/healing layer — DB is always source of truth, tasks self-noop against it. C is equivalent to A with less familiarity.
- **Consequences:** One external dependency and its dashboard to manage; failure mode (missed wake) is covered by the cron; task cancellation deferred to P1 because self-noop makes stale tasks harmless.

### ADR-2: Cloud LLM + encryption at rest vs local models

- **Decision:** Anthropic API; Supabase encryption at rest; Langfuse on Spence's own account. Decision content is personal but not regulated; the user is the operator.
- **Consequences:** Document the tradeoff in the README explicitly — the hiring signal is the reasoning, not a local model. Redaction of decision text from traces is rejected: it would gut trace usefulness for a single-operator personal tool.

### ADR-3: Outcome-blind judging vs outcome-aware with a "don't result" instruction

- **Options:** (A) Judge sees only decision-time artifacts. (B) Judge sees outcomes but is instructed to ignore them.
- **Decision:** A. Blindness enforces the resulting guard **by construction** rather than by instruction — structurally stronger and easier to defend in an interview. B survives as an eval-only variant: the P1 contamination experiment runs both on the gold set and measures how much outcome knowledge shifts judge scores. That delta is a quantified answer to "does your judge result?" — README gold.
- **Consequences:** Judge input assembly must be provably outcome-free (assertion-tested); the judge can score at commit time, which is also better UX.

### ADR-4: Prompts as versioned repo files vs DB-managed prompts

- **Decision:** `prompts/*_v{n}.md` in git, registered into `prompt_versions` at startup; every LLM call and Langfuse trace tagged with the version. Prompt iteration history **is** the portfolio artifact — it must live where diffs are visible.
- **Consequences:** No runtime prompt editing (fine — single operator); eval CLI addresses versions by file.

### Interview-defensibility constraint (carries the NSI pattern forward)

Three tasks are tagged `[HAND]` in `loop/TASKS.md` — Brier + rolling Brier, calibration-curve binning, pre-mortem surface rate. The loop authors their test suites from `METRICS.md` vectors and their type signatures, then skips implementation. Spence hand-writes these ~3 functions. They are the most interview-probed pure logic in the codebase.

## 9. Success Metrics

**Leading (this month):** judge within-1 agreement ≥ 80%/dimension on gold set n ≥ 20; pre-mortem surface-rate baseline established for v1; ≥ 10 real decisions logged; deploy live.
**Lagging (by Sept):** Brier trend chart with ≥ 15 resolved forecasts; one prompt A/B delta published; 60s demo recorded (opens on the dashboard, not the form — script in `EVAL_PLAN.md` §6); README eval table showing judge-prompt iteration history.

## 10. Phasing

Maps 1:1 to `loop/TASKS.md`: P0 scaffold → P1 data model → P2 metrics lib (TDD; contains the `[HAND]` trio) → P3 core flows → P4 scheduling → P5 check-in → P6 judge → P7 eval harness → P8 dashboard → P9 ship. Phases P0–P2 are the highest-confidence unattended-loop territory (pure logic, hard gates). P3–P5 benefit from checkpoint review of UX. Gold-set labeling (Spence, ~10–15 min/decision × 20–30) runs in parallel and blocks only P7's *real* eval runs — fixtures unblock the harness build itself.

## 11. Risks

- **Judge never reaches 80% within-1** → the iteration story is still publishable, but scores stay "experimental." Mitigation: rubric anchors are written to be judgeable (see `JUDGE_RUBRIC.md`); MAE reported alongside so near-misses are visible.
- **Trigger.dev long-wait limits or platform quirks** → reconciliation cron already makes the DB authoritative; worst case, waits degrade to cron-only (ADR-1 option B) with zero data-model change.
- **Scope creep toward "AI decision coach"** → Non-goal #2 is load-bearing. Any generative advice feature is out.
- **Gold-set labeling stalls** → decoupled by design; also it's the single highest-value hour of Spence-time in the project — treat it like the interview prep it secretly is (each labeled decision is a STAR-story quarry).
- **Loop-built code Spence can't defend** → `[HAND]` trio + checkpoint audits (Fable reviews diffs against this spec at phase boundaries).

## 12. Open Questions

- **[Spence, non-blocking]** Default check-in cadence 2w/2m/6m — right for your decision mix, or should 6m be optional per stakes level?
- **[Spence, non-blocking]** Desired-outcome flag UX: per-forecast checkbox ("is this the outcome you want?") is the current design; confirm it doesn't feel like clutter after 5 real entries.
- **[Build, non-blocking]** shadcn chart primitives vs recharts direct for the calibration curve — loop may choose; revisit at P8 checkpoint.
