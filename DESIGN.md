# Design Direction — called-it

**Status:** Direction PENDING (Spence + Fable session, due before P8; P3–P7 build on placeholder tokens).
**Hard convention (in force from T01, non-negotiable):** All UI styling uses the semantic tokens defined in the Tailwind config below — never raw palette values (`bg-zinc-100`), never hex, never one-off arbitrary values. This makes the visual identity late-bindable: when this doc's Direction section is filled in, applying it is a token swap, not a refactor. The loop must not invent a visual identity; until Direction is filled, neutral shadcn defaults expressed through these tokens are correct.

## Semantic tokens (placeholder values until Direction lands)

Defined as CSS variables consumed by Tailwind (shadcn pattern). Required set:

| Token | Role |
|---|---|
| `background`, `surface`, `surface-raised` | page, card, elevated card |
| `foreground`, `muted-foreground` | primary and secondary text |
| `accent`, `accent-foreground` | primary interactive color |
| `positive`, `caution`, `destructive` | semantic states (calibration good/drift/bad reuse these — no new ad-hoc reds/greens) |
| `border`, `ring` | hairlines, focus |
| `chart-1` … `chart-6` | categorical chart palette |
| `chart-reference` | reference lines (e.g., the perfect-calibration diagonal) — always visually subordinate to data series |

Type: two-role scale only — `font-sans` for UI, `font-mono` for numbers/probabilities/metric values (all metric figures render mono; this is in force now, not pending). Spacing: Tailwind default scale; no arbitrary values.

## Direction (TODO — fill from the design session)

- **Concept / mood:** _e.g., "instrument panel, not journal" — TBD_
- **Palette values:** _map real values onto the tokens above_
- **Type choices:** _actual families + scale_
- **Dashboard layout concept:** _the demo opens here; this is the money shot_
- **Chart styling rules:** _dot/line weights, grid treatment, how min-n greying reads_
- **Empty/threshold states tone:** _feeds T50_

## Rules for the loop (P3+)

1. Semantic tokens only, per the hard convention above.
2. Numbers are mono, always.
3. If a needed token doesn't exist, add it to the table here AND the config in the same commit — never inline a value.
4. Do not attempt visual flourish while Direction is TODO. Structure, hierarchy, and accessibility now; identity later.
