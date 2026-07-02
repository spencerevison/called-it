# Eval Plan

The eval harness is why this project clears the senior-AI-engineering bar. Build order is deliberate: **harness before polish, fixtures before gold set** — the harness must run end-to-end on 3 synthetic fixtures with a mocked LLM (CI smoke, T44) so gold-set labeling never blocks the build.

## 1. Gold set

20–30 of Spence's real historical decisions, one JSON file each in `goldset/` (see `goldset/example-001.json`). Committed to the repo **only if** Spence is comfortable with the content being public — otherwise `goldset/` is gitignored and the README states n and methodology. Decide per-item; the example file shows the neutral register to aim for.

### Entry schema

```json
{
  "id": "gs-001",
  "decision": {
    "title": "string",
    "context": "situation as knowable at decision time — write this first, before re-reading how it ended",
    "rationale": "why the chosen option, as remembered from decision time",
    "options_considered": ["..."],
    "chosen_option": "string",
    "decided_on": "YYYY-MM-DD",
    "stakes": "low|medium|high",
    "reversibility": "one_way|two_way"
  },
  "forecasts": [
    { "question": "binary, concretely resolvable", "probability": 0.7, "desired": true, "outcome": true }
  ],
  "outcome": {
    "summary": "what actually happened",
    "failures": [
      { "description": "specific thing that went wrong", "was_knowable": true }
    ]
  },
  "human_labels": {
    "judge_scores": { "risk_comprehensiveness": 1, "calibration_given_knowable": 1, "process_quality": 1 },
    "score_rationales": {
      "risk_comprehensiveness": "one sentence citing the record",
      "calibration_given_knowable": "one sentence",
      "process_quality": "one sentence"
    },
    "expected_premortem_risks": [
      "failure modes a thoughtful peer could have surfaced at decision time (superset of knowable failures that occurred)"
    ]
  }
}
```

Forecasts may be reconstructed for historical items ("what would I honestly have said then?") — mark reconstruction honestly in `context` if confidence is low; these feed judge D2, not Brier (historical forecasts never enter the live dashboard's Brier).

## 2. Harness CLIs (T40–T45)

| Command | What it does | Output |
|---|---|---|
| `pnpm eval:import` | Validate + load `goldset/*.json` into `eval_items` | count + schema errors |
| `pnpm eval:judge --version judge_v1` | Judge every item outcome-blind (`decision` + `forecasts` fields only); compare to `human_labels.judge_scores` | per-dimension within1 / exact / MAE, macro within1; disagreement cases (with both rationales) print to stdout and to `docs/eval/detail/` (gitignored); the **committed** report at `docs/eval/judge_v1_<date>.md` contains aggregate metrics and item ids only; row → `eval_runs` |

**Privacy rule for all committed eval artifacts:** gold-set entries are personal content. Anything committed to the repo (`docs/eval/*.md`, README tables) is content-free by design — aggregate metrics, prompt versions, and item ids only. Anything that quotes an entry (disagreement rationales, generated risks, matching sessions) writes to stdout or `docs/eval/detail/`, which is gitignored. This applies to every CLI in this table.
| `pnpm eval:premortem --version premortem_v1` | Generate a pre-mortem per item from decision-time fields; match generated risks against `outcome.failures[was_knowable]` ∪ `expected_premortem_risks` | surface rate (per-failure primary, per-decision companion); report + `eval_runs` row |
| `pnpm eval:compare --kind premortem v1 v2` | Both versions, same items, one table | delta table (surface rate, mean risks generated, cost/item, p50 latency) |
| `pnpm eval:contamination` (deferred — `[DEFER]` in TASKS) | Judge each item twice: blind vs an outcome-aware variant prompt | mean score delta by dimension, split by good/bad outcome — quantified resulting susceptibility |

**Risk↔failure matching (v1):** assisted-manual. The CLI prints generated risks beside each knowable failure; the human marks matches interactively; matches persist keyed by `(eval_item, failure_index, prompt_version)` so re-runs of the *same* version reuse them. Matching a new prompt version over 25 items is ~15–20 minutes — acceptable at this n; an LLM-assisted matcher with human spot-check is P1. This judgment call is documented in the README (it's a defensible scoping answer in interviews: "at n=25 the human matcher is cheaper and more trustworthy than validating an automated one").

**Cost/latency:** every eval call runs through Langfuse with tags `{run_id, prompt_version, item_id}`; the report pulls cost/item and p50/p95 latency from the run's traces.

## 3. Fixtures (CI smoke, T44)

3 synthetic items in `goldset/fixtures/` + deterministic mocked LLM responses. CI asserts: import validates, agreement math produces the hand-computed values in the fixture header comments, reports render. No live API calls in CI, ever; the smoke runs against the in-memory store (no DB).

## 4. Acceptance bars

- Judge: **within1 ≥ 0.80 per dimension** (n ≥ 20) → removes the UI "experimental" badge. Below bar: iterate per `JUDGE_RUBRIC.md` §Iteration; the report sequence is publishable either way.
- Pre-mortem: no absolute bar — v1 establishes the baseline; the deliverable is a **measured v1→v2 delta** (SPEC G4).

## 5. README eval table (the artifact hiring managers actually read)

| Run | Prompt | n | within1 (D1/D2/D3) | Surface rate | Cost/item | Note |
|---|---|---|---|---|---|---|
| *(populated from `eval_runs` as iterations land — the point is the trajectory, including regressions)* |

## 6. Demo script (60s, dashboard-first — record at P9)

- **0–10s:** calibration dashboard. "N decisions over M weeks. My Brier is X — and the interesting part is here." → one bias panel finding.
- **10–25s:** the finding in plain language (e.g., optimism bias on desired outcomes of +Y points). "The system surfaced this from my own history."
- **25–40s:** how: decision entry → pre-mortem → commit → **Trigger.dev dashboard showing a live 6-month wait** → check-in flow with the recalled-probability reveal.
- **40–55s:** eval screen: "the judge is validated against my own hand labels — Z% within-1 agreement — and pre-mortem prompt v2 surfaces Q% more real failure modes than v1. Langfuse tracks cost and latency per version."
- **55–60s:** repo URL.
