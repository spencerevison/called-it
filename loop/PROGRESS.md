# PROGRESS — called-it build log

Format: `<ISO timestamp> | T## | gates: pass|fail → blocked | <short-sha> | <one-line note>`
Appended by the loop, one line per iteration. Humans read bottom-up.

---
2026-07-02T05:15:41Z | T01 | gates: pass | ee05d05 | Next.js 16.2.9, React 19.2.4, Tailwind v4.3.2, shadcn base-nova style, vitest 4.1.9, pnpm 11.9.0; full DESIGN.md semantic token set wired in globals.css @theme
2026-07-01T22:17:00Z | T02 | gates: pass | 12a8781 | GH Actions ci.yml (push/PR) pins node 22, pnpm 11.9.0, runs pnpm check
2026-07-01T22:19:00Z | T03 | gates: pass | 7e8cc11 | @supabase/supabase-js 2.110.0 + @supabase/ssr 0.12.0; server/browser clients, .env.example (all vars), pnpm db:types stub against placeholder Database type until T05+ migrations exist
2026-07-02T05:27:38Z | T04 | gates: pass | c9787a1 | @playwright/test 1.61.1; playwright.config.ts + e2e/smoke.spec.ts against pnpm dev webServer; vitest excludes e2e/**
2026-07-02T05:41:00Z | T05 | gates: pass | edb3516 | supabase CLI 2.109.0 as devDep + supabase init; migration 20260701000000_enums_and_profiles.sql (10 enums + profiles); verified via `supabase db reset` against local Docker Postgres (analytics service disabled in config.toml, unrelated to migration)
2026-07-02T22:40:00Z | T06 | gates: pass | b559a4f | migration 20260702000000_decisions_and_events.sql (decisions, decision_events + indexes); verified via supabase db reset + throwaway psql insert/cascade-delete test
2026-07-02T22:43:00Z | T07 | gates: pass | 7bf89e8 | migration 20260703000000_forecasts.sql (forecasts + probability check + indexes); verified via supabase db reset + psql insert test (p=0.5 ok, p=0.005 rejected by check constraint)
2026-07-01T22:47:00Z | T08 | gates: pass | 49a1505 | migration 20260704000000_premortems.sql (premortems, premortem_risks + index); verified via supabase db reset + psql cascade-delete test (decision delete → premortem + risk rows gone)
2026-07-01T22:50:00Z | T09 | gates: pass | 0e0c1c9 | migration 20260705000000_checkins.sql (checkins incl. overall_attribution, checkin_failures + indexes); verified via supabase db reset + psql test (null linked_risk_id ok, bogus uuid rejected by FK)
2026-07-01T23:15:00Z | T10 | gates: pass | 77c714b | migration 20260706000000_prompts_and_eval.sql (prompt_versions, judge_scores, eval_items, eval_runs); verified via supabase db reset + psql test (valid prompt_version insert ok, bogus prompt_version rejected by FK)
2026-07-01T23:22:00Z | T11 | gates: pass | d7dc022 | migration 20260707000000_rls.sql: RLS + explicit table grants (RLS alone isn't enough -- Postgres still needs base GRANTs, migrations aren't covered by supabase_admin's default privileges); pnpm test:db added (vitest.db.config.ts, global-setup pulls creds from `supabase status`), 5 policy specs green against local instance
2026-07-02T06:30:01Z | T12 | gates: pass | 27d7d4e | scripts/seed.ts (tsx devDep) -- 4 committed decisions/1 reversal, 12 forecasts/7 resolved/4 desired/2 recalled, 2 completed checkins, 5 failures (4 knowable/2 linked); header hand-values verified against local db counts, db:seed idempotent
2026-07-02T06:36:34Z | T13 | gates: pass | 878ae9b | metrics lib: M1/M2/M10 HAND stubs quarantined to *.hand.test.ts (pnpm test:hand); M3-M9 implemented directly to keep pnpm check green (see QUESTIONS.md)
