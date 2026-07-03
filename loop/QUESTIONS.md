# QUESTIONS — assumptions, blocks, parking lot

## Assumptions made (loop logs the smallest-reasonable-interpretation calls here)

- T01: shadcn/ui's current CLI (v4) generates its default theme via a "preset" flag rather than the plain neutral base-color flow the older CLI had. Picked preset `nova` (Lucide/Geist) as the closest match to a neutral, unopinionated default. Also added `surface`, `surface-raised`, `positive`, `caution`, `chart-6`, `chart-reference` CSS vars on top of shadcn's defaults since DESIGN.md's required token set exceeds shadcn's out-of-box tokens.
- T01: added a minimal `page.test.tsx` smoke test (not just a bare scaffold) because the AC requires `pnpm check` (which runs `vitest run`) to pass, and vitest errors with zero test files. T04 will add the more deliberate example test per its own AC; this one stays as basic coverage for the home page.

## Blocked tasks (detail behind [BLOCKED] tags in TASKS.md)

## Parking lot (good ideas outside SPEC scope — do not build)
