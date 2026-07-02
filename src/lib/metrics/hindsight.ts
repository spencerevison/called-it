// M3 -- hindsight bias coefficient.

export interface HindsightForecast {
  p: number;
  r: number; // recalled_probability
  o: 0 | 1;
}

export interface HindsightResult {
  value: number | null;
  n: number;
}

/**
 * Signed drift of recalled probability toward the outcome, averaged. Min-n
 * gating (5) lives at the aggregation layer -- this returns the raw value + n.
 */
export function hindsightBias(forecasts: HindsightForecast[]): HindsightResult {
  const n = forecasts.length;
  if (n === 0) return { value: null, n };

  const drifts = forecasts.map((f) => (f.r - f.p) * (f.o === 1 ? 1 : -1));
  const value = drifts.reduce((a, b) => a + b, 0) / n;
  return { value, n };
}
