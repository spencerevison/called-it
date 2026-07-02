// M5 -- confidence granularity (round-number clustering).

export interface GranularityResult {
  round10Rate: number;
  round5Rate: number;
  fiftyRate: number;
  n: number;
}

/**
 * All forecasts (resolved or not) -- this measures entry behavior, not
 * accuracy. Multiple-of checks done on integer basis points so floating
 * point modulo doesn't misclassify values like 0.7.
 */
export function confidenceGranularity(probabilities: number[]): GranularityResult {
  const n = probabilities.length;
  if (n === 0) return { round10Rate: 0, round5Rate: 0, fiftyRate: 0, n: 0 };

  let round10 = 0;
  let round5 = 0;
  let fifty = 0;
  for (const p of probabilities) {
    const bp = Math.round(p * 10000);
    if (bp % 1000 === 0) round10++;
    if (bp % 500 === 0) round5++;
    if (bp === 5000) fifty++;
  }

  return {
    round10Rate: round10 / n,
    round5Rate: round5 / n,
    fiftyRate: fifty / n,
    n,
  };
}
