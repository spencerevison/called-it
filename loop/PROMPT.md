# Loop Prompt — called-it build

You are Claude Code building the Called It defined in `SPEC.md`. This file is your standing instruction for one loop iteration. Complete exactly **one task**, then stop.

## Read order (every iteration)

1. `loop/TASKS.md` — find your task (rules below)
2. `loop/PROGRESS.md` — last 10 lines, for context on where the build is
3. `SPEC.md` sections relevant to the task, plus whichever companion doc the task cites (`DATA_MODEL.md`, `METRICS.md`, `JUDGE_RUBRIC.md`, `EVAL_PLAN.md`, `DESIGN.md` — the last for any UI task, per the P3 header note)

## Task selection

- Take the **first** unchecked task (`- [ ]`) that is not tagged `[HAND]` or `[BLOCKED: …]`, respecting listed dependencies.
- A task carrying `(deps: T##, …)` is **skipped** until every listed task is checked — even if it's the first unchecked one. This is how `[HAND]`-dependent tasks (e.g. the aggregation/dashboard tasks that call the `[HAND]` metric fns) avoid being attempted against still-throwing stubs; leave them for a later run after Spence lands the `[HAND]` trio.
- `[HAND]` tasks are Spence's to implement. Never implement them. Where a `[HAND]` task's tests or type signatures are owed by an earlier task (T13), they already exist — leave the implementation stubbed with `throw new Error("HAND: not yet implemented")` so the suite shows them red, and exclude those specs from the CI gate via the documented tag (see T13 AC).
- `[DEFER]` tasks are skipped until every non-`[DEFER]`, non-`[HAND]` task is checked or blocked.
- **Durable attempt memory:** before starting a task, scan `loop/PROGRESS.md` for prior `gates: fail` or `gates: incomplete` lines against this task id. Each prior failed attempt counts as a used rung on the failure ladder below — a task that failed once in an earlier session starts at rung 2 (one more different approach, then escalate), not at zero.

## How to work

- **TDD**: write or extend the failing test first, then implement, then green. For T13 specifically: transcribe the test vectors from `METRICS.md` verbatim — do not invent your own expected values.
- **Gates**: `pnpm check` (typecheck + lint + unit tests) must pass before you commit. Tasks tagged `[E2E]` additionally require `pnpm test:e2e`.
- Never weaken a gate to pass it: no skipped tests (the `*.hand.test.ts` split for `[HAND]` stubs is the sanctioned mechanism, not a skipped test), no `any`, no `eslint-disable` without a one-line justification comment, no loosening `tsconfig`.
- LLM calls are always mocked in tests. Live calls only behind `ANTHROPIC_API_KEY` presence checks. Never commit `.env`; keep `.env.example` current.
- Dependency versions: latest stable major at install time unless SPEC pins one with a stated reason; record installed majors in the PROGRESS line for scaffold/setup tasks.
- Scope discipline: build only what the task and SPEC require. SPEC §4 non-goals are hard walls. Good ideas go in `loop/QUESTIONS.md` under "Parking lot," not into code.

## On completion of the task

1. Check the box in `loop/TASKS.md`.
2. Commit: `feat(T##): <summary>` (or `fix`/`chore` as appropriate). One task = one commit.
3. Append one line to `loop/PROGRESS.md`:
   `<ISO timestamp> | T## | gates: pass | <short-sha> | <one-line note>`
4. Stop. Do not start the next task.

## Delegation (subagents in .claude/agents/)

- **scout** (Haiku): use it for codebase reconnaissance — locating files, patterns, usage sites — instead of running exploratory searches in your own context. Implement in your context; explore in scout's.
- **escalation-debugger** (Fable): invoked only by the failure protocol below. When invoking, pass the model explicitly (`claude-fable-5`) — do not rely on frontmatter resolution alone. Give it: the task text, both attempted approaches (summarized honestly, including what you now suspect was wrong), and the verbatim failing gate output.

## On failure

1. `pnpm check` fails → try a **genuinely different** approach (different design, not a tweak).
2. Second approach also fails → invoke **escalation-debugger** with the context described above. Implement its PRESCRIPTION as attempt three, then run gates. If it returned "spec ambiguity," also log both readings in `loop/QUESTIONS.md`.
3. Attempt three fails (or the prescription can't be implemented) → revert to the last green state, edit the task line to `- [ ] T##: … [BLOCKED: <one-line reason>]`, log detail incl. the debugger's diagnosis in `loop/QUESTIONS.md`, append a `gates: fail → blocked` line to PROGRESS, commit the bookkeeping, stop.
- If a task is ambiguous before any attempt: choose the smallest reasonable interpretation, note the assumption in `loop/QUESTIONS.md`, and proceed. Only block on ambiguity when interpretations diverge structurally (e.g., schema shape).

## Clean exit (every iteration, no exceptions)

End every iteration with a clean working tree: either the task's commit(s), or a full revert to HEAD plus a bookkeeping commit. The runner treats a dirty tree at iteration start as a crash and halts the whole loop — leaving uncommitted changes doesn't save work, it stops the run. If you are running low on turns mid-task: stop coding, revert or commit to a clean state, and log `gates: incomplete | attempt N` for the task in `loop/PROGRESS.md` so the next iteration resumes the ladder at the right rung.

## Stop conditions (write a `## SUMMARY` section at the end of PROGRESS.md, then exit)

- All non-`[HAND]` tasks are checked or blocked.
- You cannot find the repo scaffolding this file assumes (you are likely in the wrong directory — say so and exit).
