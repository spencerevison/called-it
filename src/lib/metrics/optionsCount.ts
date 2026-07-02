// M7 -- options-considered count.

export interface OptionsCountResult {
  mean: number | null;
  n: number;
}

/**
 * counts = length of options_considered per committed decision (draft
 * entries excluded by the caller). Trend-by-commit-month lives at the
 * aggregation/display layer.
 */
export function optionsCount(counts: number[]): OptionsCountResult {
  const n = counts.length;
  if (n === 0) return { mean: null, n };

  return { mean: counts.reduce((a, b) => a + b, 0) / n, n };
}
