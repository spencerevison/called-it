// M6 -- horizon calibration gap.

export interface HorizonForecast {
  p: number;
  o: 0 | 1;
  horizonDays: number; // resolved_at - created_at
}

export interface HorizonGapResult {
  gap: number | null;
  shortN: number;
  longN: number;
}

function meanSquaredError(forecasts: { p: number; o: 0 | 1 }[]): number {
  return forecasts.reduce((a, f) => a + (f.p - f.o) ** 2, 0) / forecasts.length;
}

/**
 * short <= 30d, long > 90d; 31-90d excluded by design (contrasts the ends).
 * gap = brier(long) - brier(short). Min-n (5/side) gating is the aggregation
 * layer's job -- this returns the raw value + both counts.
 */
export function horizonGap(forecasts: HorizonForecast[]): HorizonGapResult {
  const short = forecasts.filter((f) => f.horizonDays <= 30);
  const long = forecasts.filter((f) => f.horizonDays > 90);

  if (short.length === 0 || long.length === 0) {
    return { gap: null, shortN: short.length, longN: long.length };
  }

  return {
    gap: meanSquaredError(long) - meanSquaredError(short),
    shortN: short.length,
    longN: long.length,
  };
}
