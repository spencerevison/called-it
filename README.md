# called-it — spec bundle

*Called It: a decision journal that checks whether you actually called it.*

Fable-authored spec bundle, 2026-07-01. Sonnet builds against it; Fable audits at phase checkpoints.

## Contents

| File | What it is |
|---|---|
| `SPEC.md` | The PRD — scope, requirements, 4 ADRs, phasing, risks. Governs everything. |
| `DATA_MODEL.md` | Normative SQL schema, indexes, RLS, integrity rules. |
| `DESIGN.md` | Design direction stub — the semantic-token convention is binding from T01; the Direction section gets filled by a design session before P8 (Claude Design optional for exploration; this file is the loop's contract either way). |
| `METRICS.md` | All 10 metrics with exact formulas and hand-computed test vectors (TDD source of truth). |
| `JUDGE_RUBRIC.md` | The judging rubric — shared verbatim by the judge prompt, your hand labels, and the agreement math. |
| `EVAL_PLAN.md` | Gold-set schema, harness CLIs, A/B + contamination protocol, README eval table, 60s demo script. |
| `prompts/premortem_v1.md`, `prompts/judge_v1.md` | Real v1 prompt templates, versioned in-repo per ADR-4. |
| `goldset/example-001.json` | Fully worked gold-set example — the register and depth to copy. |
| `loop/PROMPT.md` | The standing instruction Sonnet gets each iteration. |
| `loop/TASKS.md` | 54 tasks, phased P0→P9, ACs per task, `[HAND]`/`[E2E]`/`[DEFER]` tags. |
| `loop/loop.sh` | The runner + stop conditions: `.loop-stop` · no eligible tasks · dirty-tree halt (crash detection) · shell-side `pnpm check` after claimed progress (the model doesn't grade its own homework) · stall detector (`STALL_LIMIT`, default 2 no-progress iterations) · `MAX_ITER` as the budget ceiling. |
| `loop/PROGRESS.md`, `loop/QUESTIONS.md` | Loop bookkeeping — read these first when you check in on it. |
| `.claude/agents/escalation-debugger.md` | Fable-powered diagnose-and-prescribe subagent; fires only via the failure protocol (two failed attempts). **Flip `model:` to `claude-opus-4-8` after July 7.** |
| `.claude/agents/scout.md` | Haiku read-only recon subagent — keeps exploration out of the orchestrator's context. |

## First run (calibration)

```bash
mkdir called-it && cd called-it && git init
# copy this bundle's contents into the repo root (SPEC.md etc. at root; loop/, prompts/, goldset/ as dirs)
git add -A && git commit -m "chore: spec bundle v1.1"
MAX_ITER=3 ./loop/loop.sh        # ~1 hr; T01–T03 territory
```

Then check the usage bars — the %/loop-hour delta from these 3 iterations is the planning number for Fri–Sun. Continue with a bigger `MAX_ITER` if the budget math says so; ceiling per the earlier plan: All-models ~55–60% tonight.

Two subagent checks when the escalation first fires (grep `loop/loop.log` for `escalation-debugger`): (1) confirm it actually ran on Fable — there's a known Claude Code bug where frontmatter `model:` is ignored unless passed per-invocation, which is why PROMPT.md tells the orchestrator to pass it explicitly; (2) check which bar the call burned — Fable's own bar vs All-models — since that determines how freely the escalation rung can fire before Tuesday.

## Your homework (not loop-able, highest-leverage)

1. **Gold set** — copy `goldset/example-001.json` per real decision, 10–15 min each, target 20–30. Write `context` before re-reading how things ended; label per `JUDGE_RUBRIC.md` §Hand-labeling. Blocks only P7's real eval runs; start anytime. (Side effect: each entry is STAR-story quarry.)
2. **`[HAND]` trio** — T14 (Brier), T15 (calibration binning), T19 (surface rate). Tests will already exist after T13; you implement to green. Budget ~1–2 hrs total, whenever P2 lands.
3. **Two flagged decisions to sanity-check** (SPEC Open Questions): outcome-blind judging (ADR-3) and the check-in recalled-before-revealed ordering (F2). Both are my calls — override early if they feel wrong.
4. **Design-direction session** — one focused session (Fable chat, or Claude Design if you want to explore the dashboard visually) to fill `DESIGN.md`'s Direction section. Due before P8, ideally before the weekend's P3 work; not a blocker for tonight.

## Checkpoint cadence (Fable audits)

At each phase boundary (or ~daily): paste `git log --oneline` + `loop/PROGRESS.md` + `loop/QUESTIONS.md` into a Fable chat with the diff of anything suspicious. Cheap tokens, catches drift.
