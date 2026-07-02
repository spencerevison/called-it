// M4 -- optimism bias coefficient.

export interface OptimismForecast {
  p: number;
  o: 0 | 1;
}

export interface OptimismResult {
  value: number | null;
  n: number;
}

/**
 * mean(p) - mean(o) over desired forecasts (caller pre-filters desired=true
 * for the primary value, desired=false for the control). Min-n (5) gating
 * lives at the aggregation layer.
 */
export function optimismBias(forecasts: OptimismForecast[]): OptimismResult {
  const n = forecasts.length;
  if (n === 0) return { value: null, n };

  const meanP = forecasts.reduce((a, f) => a + f.p, 0) / n;
  const meanO = forecasts.reduce((a, f) => a + f.o, 0) / n;
  return { value: meanP - meanO, n };
}
