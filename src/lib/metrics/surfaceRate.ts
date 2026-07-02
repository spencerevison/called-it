// M10 -- pre-mortem surface rate. [HAND]: Spence implements this one by hand.

export interface KnowableFailure {
  decisionId: string;
  linked: boolean; // linked_risk_id !== null
}

export interface SurfaceRateResult {
  perFailure: number | null;
  perDecision: number | null;
}

/**
 * Inputs are already filtered to was_knowable = true failures on resolved
 * decisions -- unknowable failures never reach this function.
 */
export function surfaceRate(_failures: KnowableFailure[]): SurfaceRateResult {
  throw new Error("HAND: not yet implemented");
}
