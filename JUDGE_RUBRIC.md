# Judge Rubric — v1

The judge scores **decision process quality at decision time**, never outcomes. It runs outcome-blind by construction (ADR-3): its input contains only decision-time artifacts. This rubric is shared verbatim by (a) the judge prompt, (b) Spence when hand-labeling the gold set, and (c) the eval harness's agreement math. One rubric, three consumers — drift between them invalidates the eval.

## Input (assembled by T38, assertion-tested outcome-free)

`title, context, rationale, options_considered, chosen_option, stakes, reversibility, forecasts[{question, probability, desired}], risks[{description, category, severity, source}]`

For gold-set items (historical decisions with no in-app pre-mortem), `risks` may be empty; dimension D1 then scores the risk awareness present in `rationale` and `context`. This is intentional so one rubric covers both live and historical judging.

## Dimensions (score each 1–5, integers only)

### D1 · Risk comprehensiveness
*Did the pre-decision risk analysis (pre-mortem risks + rationale) cover the failure modes that were material and knowable at decision time?*

- **1** — No risk consideration, or only generic boilerplate ("might not work out") with no decision-specific content.
- **2** — One or two obvious risks named; major knowable categories absent.
- **3** — The obvious risk categories are covered; at least one material, knowable failure mode is missing; risks are decision-specific but shallow (no severity or likelihood differentiation).
- **4** — All material knowable failure modes covered with decision-specific detail; little to no second-order thinking (knock-on effects, interaction between risks).
- **5** — Comprehensive: material knowable failure modes covered **including** at least one second-order effect or risk interaction; differentiated by severity/likelihood.

*Judgeability note:* "material and knowable" means a thoughtful peer with the same information could plausibly have named it. The judge must not use hindsight it doesn't have (it has none) — it evaluates coverage against the decision context itself.

### D2 · Calibration given the knowable
*Were the stated probabilities defensible given the information visible in the decision record — regardless of what later happened?*

- **1** — Probabilities contradict the record (e.g., 0.95 on an outcome the context describes as highly contested), or every forecast is 0.5 (no information content).
- **2** — Probabilities directionally plausible but insensitive to stated evidence; heavy round-number clustering with high-confidence extremes unsupported by the rationale.
- **3** — Probabilities broadly consistent with the record; some over- or under-confidence relative to stated uncertainty; limited differentiation across forecasts.
- **4** — Probabilities track the strength of stated evidence; uncertainty acknowledged where the record shows it; differentiated across forecasts.
- **5** — As 4, plus explicit reasoning linking evidence to probability levels (base rates, reference classes, or stated uncertainty ranges).

### D3 · Process quality
*Was the decision process sound: options, disconfirming evidence, reversibility, and stopping rules?*

- **1** — Single option framed as inevitable; no engagement with downsides of the chosen path.
- **2** — Binary yes/no framing where alternatives plausibly existed; downsides listed but not weighed.
- **3** — ≥ 2 real options compared; tradeoffs stated; no evidence of seeking disconfirming information; reversibility not engaged.
- **4** — Options compared with explicit tradeoffs; at least one disconfirming consideration engaged seriously (not strawmanned); reversibility/stakes reflected in the reasoning.
- **5** — As 4, plus a stopping rule or kill criterion ("I'll reverse if X by DATE") or an explicit information-gathering step that changed the option set.

## Output schema (strict JSON)

```json
{
  "scores": { "risk_comprehensiveness": 1, "calibration_given_knowable": 1, "process_quality": 1 },
  "rationale": {
    "risk_comprehensiveness": "≤ 60 words citing specific evidence from the input",
    "calibration_given_knowable": "≤ 60 words citing specific evidence",
    "process_quality": "≤ 60 words citing specific evidence"
  },
  "evidence_spans": ["verbatim short quotes from the input that drove the scores"],
  "contamination": false
}
```

`contamination: true` if the input appears to contain outcome information (words like "turned out," past-tense results). The caller logs and alerts — it means input assembly leaked.

## Protocol

- Model: claude-sonnet-5, strict JSON. Sonnet 5 rejects sampling-parameter overrides (temperature etc. return 400), so determinism is not configurable — consistency comes from the anchored rubric and strict schema. If eval runs show score flapping on identical inputs, note it in the report and consider pinning a judge model that still accepts temperature 0. Every call tagged in Langfuse with `prompt_version` and `rubric_version: v1`.
- Scores render in the UI behind an **"experimental"** badge until the agreement bar below is met (SPEC G3).
- The rubric is versioned independently of the judge prompt: prompt iterations (v1 → v2 → …) must hold the rubric fixed, or agreement history breaks. Rubric changes reset the eval baseline and require re-labeling review.

## Agreement definition (eval harness, T41)

Per dimension on gold set (n ≥ 20):
- **within1** = share of items where `|judge − human| ≤ 1` — **bar: ≥ 0.80 per dimension**
- **exact** = share where judge = human (reported, no bar)
- **MAE** = mean |judge − human| (reported; near-misses stay visible)

Report also the macro average of within1 across dimensions. Weighted kappa is a P2 nicety, not required.

## Iteration loop (this is the portfolio signal — make it visible)

1. Run `pnpm eval:judge --version judge_v1` → report committed to `docs/eval/`.
2. Read the disagreement cases (harness prints them: item id, human score + rationale, judge score + rationale).
3. Diagnose: rubric ambiguity (→ tighten anchors, bump rubric version, re-review labels) vs prompt failure (→ new prompt version, rubric fixed). Expect prompt failures to dominate.
4. `judge_v2`, re-run, commit the new report. The README's eval table is the sequence of these reports.

## Hand-labeling guidance (Spence, gold set)

Score from the decision-time record only — you will know the outcomes; deliberately ignore them (this discipline is exactly what the tool later measures in you). 10–15 min per item: read the entry cold, assign three scores, write one sentence of rationale per score citing the record. Rationales are load-bearing: they're what makes disagreement cases diagnosable in step 2 above. If you can't score D1 because the historical record has no risk content at all, that *is* a 1 — score it, don't skip it.
