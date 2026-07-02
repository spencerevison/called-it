# QUESTIONS — assumptions, blocks, parking lot

## Assumptions made (loop logs the smallest-reasonable-interpretation calls here)

- T13: task text says "stub [HAND] implementations (M1, M2, M10)" and only routes HAND specs to `*.hand.test.ts`, while AC requires `pnpm check` green. Since M3-M9 tests would otherwise sit in the default suite calling unimplemented functions, I implemented M3-M9 (hindsight, optimism, granularity, horizonGap, optionsCount, reversalFrequency, selfServingIndex) fully in T13 rather than leaving them as signature-only stubs. T16/T17/T18 (the tasks nominally "implementing" these) will find the work already done and can just verify vectors + check the box. Only M1/M2/M10 (the three flagged hand-authored in the README build note) remain throwing stubs.

- T28: DATA_MODEL says commit freezes decision-time fields "except via logged events" and calls a revised payload a "diff." Neither the AC nor any prior task asked for a field-editing UI on active decisions, and no metric reads `revised` payloads (only M8 reads `reversed`), so I scoped "revise" to a one-line free-text note (no actual field mutation) rather than building a structured diff/edit form on top of the frozen fields -- that's a bigger, unrequested feature. Reverse/reaffirm are event-only inserts too (no `decisions` row change -- there's no "reversed" status in DATA_MODEL). All three gated to `status = 'active'` decisions.

## Blocked tasks (detail behind [BLOCKED] tags in TASKS.md)

## Parking lot (good ideas outside SPEC scope — do not build)
