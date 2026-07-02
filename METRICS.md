# Metrics — Definitions & Test Vectors

Every metric is a **pure function** in `src/lib/metrics/` operating on plain input arrays (no DB access). A separate aggregation service maps DB rows → these inputs. The test vectors below are normative: the loop writes the test suite from them **verbatim before any implementation** (T13). Tolerance: `±1e-9` unless noted.

Conventions: `p` = recorded probability ∈ [0.01, 0.99]; `o` = outcome ∈ {0, 1}; only `resolved = true` forecasts enter any metric; display layer shows "insufficient data" below the stated minimum n rather than a number.

---

## M1 · Brier score

**Definition:** `brier(F) = mean over resolved forecasts of (p − o)²`. Lower is better; 0.25 = coin-flip-with-p=0.5 baseline; superforecasters ≈ 0.1–0.15 on geopolitical questions (context line for UI, not a claim about this domain).
**Rolling Brier:** same, over forecasts resolved within a trailing window (default 90 days), plotted by resolution date.
**Min n:** 5 to display.

**Vector A:** `p = [0.9, 0.6, 0.2, 0.5]`, `o = [1, 1, 0, 0]`
→ `(0.01 + 0.16 + 0.04 + 0.25) / 4 = 0.115`
**Vector B (empty):** `[] → null` (never NaN).

## M2 · Calibration curve

**Definition:** bucket resolved forecasts into probability bins `[0.0–0.1), [0.1–0.2), …, [0.9–1.0]` (right-closed on last). Per bin: `n`, `meanPredicted`, `observedFrequency = mean(o)`. Output all non-empty bins; display layer greys bins with `n < 5`.

**Vector:** forecasts `(p, o)`: `(0.55,1), (0.58,0), (0.62,1), (0.65,1), (0.9,1), (0.92,0)`
→ bin `[0.5,0.6)`: n=2, meanPredicted=0.565, observed=0.5
→ bin `[0.6,0.7)`: n=2, meanPredicted=0.635, observed=1.0
→ bin `[0.9,1.0]`: n=2, meanPredicted=0.91, observed=0.5

## M3 · Hindsight bias coefficient

**Inputs:** resolved forecasts having `recalled_probability` (`r`).
**Definition:** per forecast, signed drift toward the outcome: `d = (r − p) · s` where `s = +1` if `o = 1`, `−1` if `o = 0`. `HB = mean(d)`. Range [−0.98, 0.98]. **HB > 0** = memory drifts toward "I knew it all along."
**Min n:** 5.

**Vector:** `(p, r, o)`: `(0.6, 0.8, 1) → (0.8−0.6)·(+1) = +0.2`; `(0.3, 0.2, 0) → (0.2−0.3)·(−1) = +0.1`
→ `HB = 0.15`

## M4 · Optimism bias coefficient

**Inputs:** resolved forecasts with `desired = true` (the YES outcome is what the user wants).
**Definition:** `OB = mean(p) − mean(o)` over desired forecasts. **OB > 0** = systematically overestimating wanted outcomes. Companion display: same quantity over `desired = false` forecasts, labeled the control.
**Min n:** 5 desired forecasts.

**Vector:** desired `(p, o)`: `(0.8,1), (0.7,0), (0.9,1), (0.72,0)`
→ `mean(p) = 3.12/4 = 0.78`, `mean(o) = 0.5` → `OB = +0.28`

## M5 · Confidence granularity (round-number clustering)

**Inputs:** all forecasts (resolved or not) — this measures entry behavior.
**Definition:** three rates over recorded `p`:
- `round10Rate` = share where `p` is a multiple of 0.10 (tolerance 1e-9)
- `round5Rate`  = share where `p` is a multiple of 0.05 (includes multiples of 0.10)
- `fiftyRate`   = share where `p = 0.50` exactly
Interpretation line: high `round10Rate` + high `fiftyRate` = coarse, uncommitted probability use.
Implementation note: do multiple-of checks on integer basis points (`Math.round(p * 10000) % 1000 === 0` etc.) — floating-point modulo misclassifies values like 0.7.

**Vector:** `p = [0.7, 0.65, 0.5, 0.72, 0.9]`
→ `round10Rate = 3/5 = 0.6` (0.7, 0.5, 0.9) · `round5Rate = 4/5 = 0.8` (+0.65) · `fiftyRate = 1/5 = 0.2`

## M6 · Horizon calibration gap

**Definition:** partition resolved forecasts by horizon `h = resolved_at − forecast created_at`: **short** ≤ 30 days, **long** > 90 days (31–90 excluded from this metric by design — it contrasts the ends). `gap = brier(long) − brier(short)`. **gap > 0** = worse at long horizons.
**Min n:** 5 per side.

**Vector:** short `(p,o)`: `(0.8,1), (0.3,0)` → `(0.04 + 0.09)/2 = 0.065`; long: `(0.9,0), (0.6,1)` → `(0.81 + 0.16)/2 = 0.485`
→ `gap = +0.42`

## M7 · Options-considered count

**Definition:** `mean(len(options_considered))` over **committed** decisions (draft entries excluded); plus trend by commit month. Interpretation anchor: chronic 1–2 = decisions framed as yes/no rather than choice sets.

**Vector:** counts `[2, 4, 3, 3] → 3.0`

## M8 · Reversal frequency

**Definition:** share of committed decisions having ≥ 1 `reversed` event: `reversalRate = |{d : reversed ∈ events(d)}| / |committed|`. Companion: median days from `committed` to first `reversed` among reversed decisions.

**Vector:** 10 committed decisions, 3 with a reversed event → `0.30`

## M9 · Luck/skill attribution pattern (self-serving index)

**Inputs:** each completed check-in carries `overall_attribution` (skill/luck/mixed — a required field at completion, see DATA_MODEL) plus an outcome valence derived from its resolved forecasts: a check-in is **good** if the majority resolved in the desired direction (`o = 1` when `desired`, `o = 0` when not), **bad** otherwise; ties = bad (conservative). Failure-row attributions feed the detail view only.
**Definition:** `SSI = P(overall_attribution = skill | good) − P(skill | bad)`. **SSI > 0** = self-serving (my wins are skill, my losses are luck). `mixed` counts as not-skill.
**Min n:** 4 per side.

**Vector:** good check-ins: skill in 3 of 4 → 0.75; bad: skill in 1 of 4 → 0.25 → `SSI = 0.50`

## M10 · Pre-mortem surface rate

**Inputs:** resolved decisions with ≥ 1 check-in failure where `was_knowable = true`.
**Definition (primary, per-failure):** `surfaceRate = |knowable failures with linked_risk_id ≠ null| / |knowable failures|`.
**Companion (per-decision):** share of such decisions where ≥ 1 knowable failure was linked.
Unknowable failures (`was_knowable = false`) are excluded — the pre-mortem is only accountable for the knowable.

**Vector:** 5 decisions, 8 knowable failures total, 5 linked → per-failure `0.625`; per-decision: 4 of 5 had ≥ 1 link → `0.8`

---

## Aggregation service contract (T20)

`getDashboardMetrics(userId)` returns all of the above from live rows, computed via the pure functions. Integration test: run against the seed dataset (T12), assert equality with hand-computed values documented in the seed file's header comment. The seed must include at least: 12 forecasts (7 resolved), 2 recalled-probability pairs, 4 desired resolved forecasts, short+long horizon coverage, 3 committed decisions with 1 reversal, 2 completed check-ins with linked and unlisted failures.

## Display rules

Every dashboard metric renders: the number, the min-n state, and **one plain-language sentence** (templates live with the components, e.g. `"Your memory shifts {X} points toward the outcome after the fact"` for M3). No metric ships without its sentence — the sentences are the product.
