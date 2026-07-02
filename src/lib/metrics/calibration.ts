// M2 -- calibration curve binning. [HAND]: Spence implements this one by hand.

export interface CalibrationForecast {
  p: number;
  o: 0 | 1;
}

export interface CalibrationBin {
  binStart: number;
  binEnd: number;
  n: number;
  meanPredicted: number;
  observedFrequency: number;
}

/**
 * Buckets resolved forecasts into [0.0-0.1), [0.1-0.2), ..., [0.9-1.0] (last
 * bin right-closed). Only non-empty bins are returned; n<5 greying happens
 * in the display layer, not here.
 */
export function calibrationCurve(_forecasts: CalibrationForecast[]): CalibrationBin[] {
  throw new Error("HAND: not yet implemented");
}
