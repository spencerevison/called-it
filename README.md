# Called It

A personal decision journal: it generates an LLM pre-mortem when you log a decision, records a
calibrated probability forecast, wakes up on a durable schedule to run a retrospective, and scores
decision **process** separately from **outcome** — backed by an eval harness that checks the LLM
judge actually agrees with a human.

## Why

People judge past decisions by how they turned out ("resulting") and never find out whether their
confidence was calibrated, whether they considered enough options, or whether their pre-decision
risk analysis caught the failures that actually happened. Called It logs the decision-time
artifacts (forecast, options considered, pre-mortem risks) before the outcome is known, then
compares them against what actually happened later. Full product rationale: `SPEC.md`.

## Architecture

Next.js (App Router) + Supabase (Postgres, RLS, auth) + Trigger.dev (durable scheduling) +
Anthropic (pre-mortem generation, LLM-as-judge scoring) + Langfuse (tracing).

- **Data model** — `DATA_MODEL.md`. All writes to user tables go through server actions; RLS is
  select-oriented. A handful of invariants (commit transaction, recall-before-reveal ordering,
  cross-decision lineage) live in the server-action layer because RLS can't express them.
- **Scheduling** — a Trigger.dev `wait.until` task per check-in, plus a daily reconciliation cron
  that treats the database as the source of truth. A task that wakes finds nothing to do if the
  database has already moved on (self-noop), so a stale or duplicate wake is harmless.
- **Metrics** — `src/lib/metrics`, pure functions over resolved forecasts/check-ins, TDD'd against
  hand-computed vectors in `METRICS.md`.
- **Judge** — `src/lib/llm/judge.ts` scores decision process against `JUDGE_RUBRIC.md`, blind to
  the outcome, right after the decision is committed.
- **Prompts** — versioned files in `prompts/*_v{n}.md`, registered into `prompt_versions` at
  startup so every LLM call and trace is tagged with the exact prompt version used.

### The four ADRs (`SPEC.md` §8)

1. **Trigger.dev durable waits, not cron-only polling** — a visibly-running multi-month wait is a
   real production pattern worth demoing; the reconciliation cron is kept as a healing layer
   underneath it so a missed wake never leaves a check-in stuck.
2. **Cloud LLM + encryption at rest, not a local model** — the decision content is personal, not
   regulated, and the single user is also the operator. The hiring signal here is reasoning about
   the tradeoff, not running a model locally.
3. **Outcome-blind judging, not outcome-aware with a "don't result" instruction** — blindness
   enforces the anti-resulting guarantee structurally instead of by prompt instruction. The
   outcome-aware variant survives only as a deferred eval-only contamination experiment (see
   `EVAL_PLAN.md`) that measures how much seeing the outcome shifts the judge's scores.
4. **Prompts as versioned repo files, not DB-managed prompts** — prompt iteration is itself a
   portfolio artifact, so it needs to live somewhere diffs are visible (git), not in a database.

## Eval methodology

- **Gold set** (`goldset/*.json`) — real decisions hand-labeled per `JUDGE_RUBRIC.md`, imported
  with `pnpm eval:import`.
- **Judge agreement** (`pnpm eval:judge --version <prompt-version>`) — runs the judge over every
  gold-set item and computes within-1 / exact / MAE agreement against the hand labels, per
  dimension. Bar: within-1 ≥ 0.80/dimension (n ≥ 20) before judge scores lose their
  "experimental" badge in the UI.
- **Pre-mortem surface rate** (`pnpm eval:premortem --version <prompt-version>`) — generates a
  pre-mortem per gold-set item and measures what fraction of the failures that actually happened
  were things the pre-mortem called out in advance.
- **Compare** (`pnpm eval:compare --kind premortem v1 v2`) — cost/latency (from Langfuse) and
  score deltas between two prompt versions, e.g. a pre-mortem v1→v2 A/B.
- **Smoke test** (`pnpm eval:smoke`) — the same import → judge → agreement pipeline against small
  synthetic fixtures, zero live LLM calls, run in CI on every push.

### Eval table

| Run | Prompt | n | within1 (D1/D2/D3) | Surface rate | Cost/item | Note |
|---|---|---|---|---|---|---|
| *(populated from `eval_runs` as real iterations land — the point is the trajectory, including regressions)* |

## Metrics glossary

| # | Metric | What it measures |
|---|---|---|
| M1 | Brier score | Forecast accuracy; lower is better, 0.25 is a coin-flip baseline. |
| M2 | Calibration curve | Whether "70% confident" predictions come true ~70% of the time. |
| M3 | Hindsight bias | Whether recalled-at-check-in probabilities drift toward the known outcome. |
| M4 | Optimism bias | Whether desired outcomes are systematically overestimated. |
| M5 | Confidence granularity | Round-number clustering (50/50, 70/30) in recorded probabilities. |
| M6 | Horizon calibration gap | Whether long-horizon forecasts are worse-calibrated than short ones. |
| M7 | Options considered | Average number of options weighed per committed decision. |
| M8 | Reversal frequency | Share of committed decisions later reversed. |
| M9 | Self-serving attribution | Whether wins get credited to skill and losses to luck. |
| M10 | Pre-mortem surface rate | Share of actual (knowable) failures the pre-mortem predicted. |

Exact formulas and hand-computed test vectors: `METRICS.md`.

## Local setup

Requires Node 22+, pnpm, a Supabase project (local via the Supabase CLI or hosted), and — for live
LLM calls — an Anthropic API key. Trigger.dev and Langfuse keys are optional locally; features
that need them degrade gracefully without one (see `.env.example` comments).

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase + Anthropic keys at minimum
supabase start                # or point NEXT_PUBLIC_SUPABASE_URL at a hosted project
supabase db push               # apply migrations in supabase/migrations
pnpm db:register-prompts       # register prompts/*.md into prompt_versions
pnpm dev                       # http://localhost:3000
```

Tests: `pnpm check` (typecheck + lint + unit tests, all LLM calls mocked), `pnpm test:db` (against
a local Supabase instance), `pnpm test:e2e` (Playwright, mocked Anthropic server).

## Build note

Built with Claude Code against a written spec (`SPEC.md` + companions) — the loop authors all
app code; an adversarial review pass from a different model checks every high-risk diff. Hand
verified by the author: the `METRICS.md` test vectors and the eval gold-set labels. See
`docs/EVIDENCE.md` for a worked example of the generator/evaluator separation catching a real bug.
