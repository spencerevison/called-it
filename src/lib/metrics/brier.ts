// M1 -- Brier score. [HAND]: Spence implements this one by hand (see README build note).

export interface BrierForecast {
  p: number;
  o: 0 | 1;
}

export interface RollingBrierForecast extends BrierForecast {
  resolvedAt: Date;
}

export interface RollingBrierPoint {
  date: Date;
  brier: number;
}

/** mean((p - o)^2) over resolved forecasts. null (not NaN) for empty input. */
export function brier(_forecasts: BrierForecast[]): number | null {
  throw new Error("HAND: not yet implemented");
}

/** brier(), windowed by resolution date, default trailing 90 days. */
export function rollingBrier(
  _forecasts: RollingBrierForecast[],
  _windowDays = 90,
): RollingBrierPoint[] {
  throw new Error("HAND: not yet implemented");
}
