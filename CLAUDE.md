# CLAUDE.md — called-it build policy

Single source of truth for how the build loop behaves. `loop/TASKS.md` says what each task *is*; this file says what to *do* about each risk level. Loaded automatically by every agent working in this repo.

## The app

**Called It** — a personal decision journal that generates an LLM pre-mortem at decision time, records calibrated probability forecasts, wakes on a durable schedule to run retrospectives, and scores decision *process* separately from *outcome* — with an eval harness that proves the LLM judge works. Full spec: `SPEC.md` (+ `DATA_MODEL.md`, `METRICS.md`, `JUDGE_RUBRIC.md`, `EVAL_PLAN.md`, `DESIGN.md`). No app code is hand-written; the loop authors everything. Defensibility rests on the harness catching what the author gets wrong — see `docs/EVIDENCE.md`.

## Roles by model

| Role | Model | Mode |
|---|---|---|
| Author | `claude-sonnet-5` | writes one task, TDD, commits on `loop/work` |
| Reviewer | `claude-fable-5` | adversarial, **read-only**, separate pass over the last commit |
| Fixer | `claude-sonnet-5` | applies the reviewer's written prescription |
| Escalated fixer | `claude-opus-4-8` | only after `N=3` failed Sonnet-fix / Fable-review cycles |
| Escalation-debugger | `claude-fable-5` | red-gate diagnosis during authoring (distinct from the reviewer) |

Fable 5 retires ~2026-07-07; when it does, Reviewer → `claude-opus-4-8` (set `REVIEWER_MODEL` in `loop.sh`). Author and fixer must not be the same tier as the reviewer, or review becomes self-grading — that's why the fixer defaults to Sonnet and only escalates to Opus when a prescribed fix repeatedly fails (signal that the fix itself needs judgment).

## Risk tags → review action (deterministic, by tag — not per-run judgment)

Every task in `loop/TASKS.md` carries one tag. The runner gates review off the tag; no one decides per-run whether to review.

| Tag | Applies to | Action after the author's green commit |
|---|---|---|
| `[risk:high]` | auth, redirects, RLS/policies, IDOR/ownership, transactional server actions, external I/O, scheduling/concurrency | Adversarial Fable review pass. Verdict → merge / fix-cycle / HALT. |
| `[risk:low]` | CRUD, forms, styling, config, read-only UI, tests, docs | No Fable pass. Gate + commit + merge. |
| `[risk:math]` | pure metric logic with `METRICS.md` test vectors | No Fable pass — the verbatim test vectors are a stronger external check than a review. (Vectors are hand-verified by the operator before the loop builds against them.) |

**Interval quality gate:** at each phase boundary (`> QUALITY GATE` marker in TASKS.md, after T20/T28/T31/T36/T39/T44) Fable reviews the *cumulative* diff since the last gate for coherence, dead code, duplication, and over-engineering. Batched, not per-commit.

## Escalation cap

Per flagged commit: Sonnet fixer → Fable re-review, up to **N=3** cycles. If still flagged after the 3rd cycle, the fixer escalates to `claude-opus-4-8` for one more cycle. Still flagged after that → HALT. (A deep task can surface a *different* genuine finding each cycle — severity trending down is the signal it's converging, not stuck; the raised cap gives it room to finish before halting for a human.)

## HALT taxonomy (stop, checkpoint on `loop/work`, wait for a human)

- Reviewer can't clear a finding within the escalation cap.
- **Any high-severity finding on an auth/DB access-control path** — hardcoded by task id (`T11` RLS, `T21` auth, `T25` ownership), NOT left to the reviewer's severity judgment. A high-severity flag on one of these does not go to the fixer; it stops for a human. (The old loop's misplaced confidence on exactly these paths is why this is hardcoded.)
- Author's committed work fails `pnpm check` when the runner re-verifies (the author claimed done on a red gate).
- A quality-gate review returns a flag (cross-cutting quality drift is a human judgment, not an auto-fix).
- Dirty `main` that survives the runner's force-reset (backstop; should not happen under atomic iterations).

Everything else logs and continues: a non-blocking reviewer note, a smallest-interpretation assumption, an adapted API — these go to `loop/QUESTIONS.md`, they don't stop the loop.

Verdicts are recorded as lightweight git tags on the merged commit: `reviewed-pass-T##`, `reviewed-flag-T##`, `reviewed-HALT-T##` (and `qg-pass-P#` / `qg-flag-P#`). Audit surface = `git tag -l 'reviewed-flag-*' 'reviewed-HALT-*'`. Rollback = reset `main` to the last `reviewed-pass-*` tag.

## Atomic iterations

The author works on `loop/work`, forked from `main`. Only a completed task that passes its review fast-forwards `main`; `main` is then pushed. A turn-cap kill or crash leaves `main` untouched — the next iteration force-discards `loop/work` and retries. The dirty-`main` halt is a backstop, not the primary defense. Turn budget per author/fixer invocation is **100**.

## ponytail scoping

ponytail (lazy/YAGNI mode) is **on for author and fixer** — shortest working diff, no speculative abstraction. It is **off for the reviewer** — the reviewer must be expansive and adversarial, not lazy. The reviewer prompt disables it explicitly (`stop ponytail`); do not remove that line.

## Logging trigger (wider than ambiguity)

Log to `loop/QUESTIONS.md` any **deviation from a literal spec instruction** — adapting to a newer API than the spec assumed, regenerating a generated file, a smallest-reasonable interpretation of an ambiguous AC, or any consequential judgment call — not only genuine ambiguity. The operator's audit depends on this surface being populated; the prior loop under-logged.

## Running the loop

The operator launches the loop in a terminal — Claude cannot (it spawns autonomous `claude -p --dangerously-skip-permissions` agents and needs the sandbox off; auto-mode blocks it). Claude's role is pre-flight, log/tag inspection, and harness debugging.

```
tmux new -s callit 'MAX_ITER=55 caffeinate -is bash loop/loop.sh'
```

`MAX_ITER` default is 40 but the backlog is ~47 tasks, so pass ~55 for a full run. `caffeinate -is` keeps the Mac awake (AC power); `touch .loop-stop` halts cleanly between iterations. First real checkpoints to watch: T11 (first `risk:high` review, a HALT path), the P2 quality gate after T20, and T29 (Trigger.dev, the fat watch-item).

## Commit style (inherited)

No mention of AI/Claude in commit messages. Keep them concise, one line where possible.
