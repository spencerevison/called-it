# QUESTIONS — assumptions, blocks, parking lot

## Assumptions made (loop logs the smallest-reasonable-interpretation calls here)

- T13: task text says "stub [HAND] implementations (M1, M2, M10)" and only routes HAND specs to `*.hand.test.ts`, while AC requires `pnpm check` green. Since M3-M9 tests would otherwise sit in the default suite calling unimplemented functions, I implemented M3-M9 (hindsight, optimism, granularity, horizonGap, optionsCount, reversalFrequency, selfServingIndex) fully in T13 rather than leaving them as signature-only stubs. T16/T17/T18 (the tasks nominally "implementing" these) will find the work already done and can just verify vectors + check the box. Only M1/M2/M10 (the three flagged hand-authored in the README build note) remain throwing stubs.

## Blocked tasks (detail behind [BLOCKED] tags in TASKS.md)

## Parking lot (good ideas outside SPEC scope — do not build)
