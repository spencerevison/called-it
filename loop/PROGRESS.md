# PROGRESS — called-it build log

Format: `<ISO timestamp> | T## | gates: pass|fail → blocked | <short-sha> | <one-line note>`
Appended by the loop, one line per iteration. Humans read bottom-up.

---

2026-07-02T19:21:00Z | T01 | gates: pass | 8aaea6b | Next.js 16 + TS strict + Tailwind v4 + shadcn/ui (nova preset); DESIGN.md token set extended onto shadcn defaults; pnpm check = typecheck && lint && vitest run.
2026-07-02T19:38:00Z | T02 | gates: pass | 0bcb964 | GH Actions workflow (.github/workflows/check.yml): pnpm/action-setup v11, node 22, pnpm install --frozen-lockfile && pnpm check on push/PR (no packageManager pin in package.json yet, versions hardcoded in workflow to match local toolchain).
2026-07-02T19:42:00Z | T03 | gates: pass | 5d7b86f | Supabase client helpers (browser+server via @supabase/ssr), .env.example (Supabase/Anthropic/Trigger.dev/Langfuse/Resend), pnpm db:types via supabase CLI devDep; placeholder Database type until T05+ migrations.
2026-07-02T19:47:00Z | T04 | gates: pass | 750e686 | Vitest (T01/T03 already covered example tests) excludes e2e/**; @playwright/test devDep, playwright.config.ts (dev server on :3100), e2e/smoke.spec.ts placeholder, pnpm test:e2e script. Both runners green locally.
2026-07-02T19:53:00Z | T05 | gates: pass | e1ca399 | supabase init (config.toml + supabase/.gitignore); migration 20260702000001_enums_profiles.sql — all DATA_MODEL enums + profiles; verified via supabase start + db reset (docker) applies cleanly to a fresh local db.
2026-07-02T19:58:00Z | T06 | gates: pass | 27d849f | migration 20260702000002_decisions_events.sql — decisions + decision_events tables + indexes per DATA_MODEL; verified via db reset + throwaway psql insert (cascade delete confirmed, remaining_events=0 after parent delete).
2026-07-03T02:51:00Z | T07 | gates: pass | cdf8da5 | migration 20260702000003_forecasts.sql — forecasts table + probability check + resolved/outcome check + indexes; resolved_in_checkin_id FK deferred to T09 per DATA_MODEL comment; verified via db reset + psql (p=0.005 rejected, resolved=true without outcome rejected, valid insert succeeds).
2026-07-03T02:56:00Z | T08 | gates: pass | a29c480 | migration 20260702000004_premortems.sql — premortems + premortem_risks tables, category CHECK (5 values) + indexes; prompt_version FK deferred to T10; verified via db reset + psql (bad category rejected, cascade delete confirmed).
2026-07-03T03:05:00Z | T09 | gates: pass | 04e455e | migration 20260702000005_checkins.sql — checkins + checkin_failures tables + indexes; added deferred forecasts.resolved_in_checkin_id FK; verified via db reset + psql (completed-without-attribution rejected, bogus resolved_in_checkin_id rejected, dup standard-horizon rejected, custom-horizon dups allowed, bogus linked_risk_id rejected, cascade delete confirmed).
2026-07-03T03:12:00Z | T10 | gates: pass | 47cb9ee | migration 20260702000006_prompt_versions_eval.sql — prompt_versions, judge_scores, eval_items, eval_runs tables + judge_scores(decision_id) index; added deferred premortems.prompt_version FK; regenerated src/lib/supabase/types.ts; verified via db reset + psql (bad prompt_version rejected on both premortems and judge_scores insert).
