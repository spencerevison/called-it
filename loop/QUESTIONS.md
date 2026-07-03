# QUESTIONS — assumptions, blocks, parking lot

## Assumptions made (loop logs the smallest-reasonable-interpretation calls here)

- T01: shadcn/ui's current CLI (v4) generates its default theme via a "preset" flag rather than the plain neutral base-color flow the older CLI had. Picked preset `nova` (Lucide/Geist) as the closest match to a neutral, unopinionated default. Also added `surface`, `surface-raised`, `positive`, `caution`, `chart-6`, `chart-reference` CSS vars on top of shadcn's defaults since DESIGN.md's required token set exceeds shadcn's out-of-box tokens.
- T01: added a minimal `page.test.tsx` smoke test (not just a bare scaffold) because the AC requires `pnpm check` (which runs `vitest run`) to pass, and vitest errors with zero test files. T04 will add the more deliberate example test per its own AC; this one stays as basic coverage for the home page.
- T03: SPEC doesn't name exact env var names for Trigger.dev/Langfuse/Resend, so `.env.example` uses each service's own SDK-conventional names (`TRIGGER_SECRET_KEY`/`TRIGGER_PROJECT_ID`, `LANGFUSE_SECRET_KEY`/`LANGFUSE_PUBLIC_KEY`/`LANGFUSE_BASE_URL`, `RESEND_API_KEY`). Added `supabase` CLI as a devDependency (not a global install) so `pnpm db:types` works reproducibly; the script runs `supabase gen types typescript --local`, which needs `supabase start` — a no-op placeholder `Database` type ships until T05+ migrations exist to introspect. Scoped the client helpers to exactly "server + browser" per the task text — no service-role/admin client yet; that lands with the first server action that needs service-role writes (DATA_MODEL rule 0).
- T08: DATA_MODEL's Indexes section only lists `premortem_risks (premortem_id)` explicitly for this table pair, but added `premortems (decision_id)` too, matching the same lookup pattern already indexed for `decisions`/`forecasts` (decision detail page will query premortems by decision_id). Small addition beyond the literal index list, not a schema-shape decision.

## Blocked tasks (detail behind [BLOCKED] tags in TASKS.md)

## Parking lot (good ideas outside SPEC scope — do not build)
