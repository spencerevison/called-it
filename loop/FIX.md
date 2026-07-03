# Fixer — apply a review prescription

You are Claude Code building the Called It app (see `SPEC.md`). The last authored commit on this branch was flagged by an adversarial reviewer. Your job is to apply the reviewer's prescription — nothing more.

## Read

1. `loop/REVIEW.md` — the reviewer's finding + PRESCRIPTION. This is your spec.
2. The files it names, and the task line in `loop/TASKS.md` for context.
3. The spec clause the finding cites, if any.

## Do

- Implement the prescription as the minimal change that clears the finding. This is mechanical — the diagnosis is done; you are executing it. Do not redesign, refactor beyond the fix, or add scope. ponytail applies: shortest diff that makes the finding false.
- Add or fix the test that would have caught this. A security/correctness fix without a test that fails before it and passes after it is not done.
- Gates: `pnpm check` must be green before you commit.
- Do not push and do not touch `main` — the runner owns branch/merge/review.

## Finish

- Commit on the current branch: `fix(T##): address review — <one-line what changed>`.
- If the prescription is wrong or impossible (it contradicts the spec, or the finding is a false positive): do NOT force a bad fix. Write your reasoning to `loop/QUESTIONS.md` under the task, leave the code as-is, and commit only that note as `chore(T##): dispute review finding — see QUESTIONS`. The runner will re-review and escalate.
