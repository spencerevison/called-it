# Local setup

How to run Called It on your machine. Assumes macOS + the tooling in the
architecture (Next.js, Supabase, Anthropic, optionally Trigger.dev / Langfuse /
Resend). Roughly 15 min for the core app; the external integrations are opt-in
and no-op when their keys are unset.

## Prerequisites

- **Node 22.18+** — the eval scripts import `.ts` directly and rely on native
  type-stripping. `node --version` to check.
- **pnpm** — `corepack enable` (ships with Node) then `pnpm -v`.
- **Docker** — Supabase runs Postgres + auth locally in containers.
- **Supabase CLI** — `brew install supabase/tap/supabase`.

## 1. Install + env

```bash
pnpm install
cp .env.example .env.local
```

You can run the whole core app with just the Supabase and Anthropic values.
Everything else degrades gracefully:

| Var(s) | Needed for | Unset behavior |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | DB, auth, all writes | app can't start |
| `ANTHROPIC_API_KEY` | pre-mortem + judge | those features skip (no live call) |
| `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_ID` | durable check-in scheduling | reconciliation cron still heals; no durable wait |
| `LANGFUSE_*` | LLM tracing | traces become local no-ops |
| `RESEND_API_KEY` | due-check-in emails | email step no-ops |
| `JUDGE_TRUSTED` | drops the "experimental" badge on judge scores | badge stays until you flip it to `true` |

## 2. Database

```bash
supabase start            # boots Postgres/auth; prints the local URL + keys
```

Copy the values it prints into `.env.local`. Newer CLI versions label the keys
`Publishable` / `Secret` instead of `anon` / `service_role` — same slots:

- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon key` / `Publishable` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role key` / `Secret` → `SUPABASE_SERVICE_ROLE_KEY`

(The legacy static local JWT keys still work too, so an existing `.env.local`
from an older `supabase start` doesn't need re-copying.) Migrations in
`supabase/migrations/` apply automatically on `start`.

Seeded user once `db:seed` has run: `seed@calledit.local`. Auth is magic-link —
enter that email, click **Send magic link**, then open Mailpit
(http://127.0.0.1:54324) and click the link in the caught email to sign in.

```bash
pnpm db:seed              # a demo user + a couple of decisions to click around
pnpm db:register-prompts  # loads prompts/*.md into prompt_versions (needed for LLM calls)
```

`db:register-prompts` is idempotent — it only inserts prompt versions whose
content hash changed, so it's safe to re-run after editing a prompt file.

## 3. Run

```bash
pnpm dev                  # http://localhost:3000
```

Sign in as the seeded user (`seed@calledit.local`) via magic link — the email is
caught by Mailpit at http://127.0.0.1:54324, click the link there. Logging a decision
triggers the pre-mortem (if `ANTHROPIC_API_KEY` is set); committing it runs the
judge.

## 4. Checks

```bash
pnpm check                # typecheck + lint + unit tests — the CI gate
pnpm test:db              # DB-backed tests (needs supabase running)
pnpm test:e2e             # Playwright (needs dev server)
```

## 5. Eval harness (optional)

Proves the judge agrees with human labels. Makes **live** Anthropic calls, so it
refuses to run without `ANTHROPIC_API_KEY`. `eval:premortem` and
`eval:contamination` are assisted-manual — they prompt you at the terminal.

```bash
pnpm eval:import          # load the gold set into eval_items
pnpm eval:judge --version judge_v1
pnpm eval:premortem --version premortem_v1
pnpm eval:compare --version judge_v1   # diff two prompt versions
```

Committed reports land in `docs/eval/` (aggregate metrics + item ids only —
never decision content, per the EVAL_PLAN privacy rule). Per-item detail goes to
the gitignored `docs/eval/detail/`.

## Notes

- All LLM calls are gated on `ANTHROPIC_API_KEY`; the test suite always mocks the
  LLM, so `pnpm check` never spends tokens or needs a key.
- Trigger.dev's durable waits need `npx trigger.dev@latest dev` running in a
  second terminal — skip it for local clicking; the daily reconciliation cron
  covers correctness without it.
