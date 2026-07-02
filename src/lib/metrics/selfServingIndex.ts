// M9 -- luck/skill attribution pattern (self-serving index).

export type Attribution = "skill" | "luck" | "mixed";

export interface AttributionCheckin {
  attribution: Attribution;
  good: boolean; // majority of resolved forecasts landed the desired way; ties = bad
}

export interface SelfServingIndexResult {
  value: number | null;
  goodN: number;
  badN: number;
}

function skillRate(checkins: AttributionCheckin[]): number | null {
  if (checkins.length === 0) return null;
  const skillCount = checkins.filter((c) => c.attribution === "skill").length;
  return skillCount / checkins.length;
}

/**
 * SSI = P(skill | good) - P(skill | bad). mixed counts as not-skill.
 * Min-n (4/side) gating lives at the aggregation layer.
 */
export function selfServingIndex(checkins: AttributionCheckin[]): SelfServingIndexResult {
  const good = checkins.filter((c) => c.good);
  const bad = checkins.filter((c) => !c.good);

  const pGood = skillRate(good);
  const pBad = skillRate(bad);
  const value = pGood === null || pBad === null ? null : pGood - pBad;

  return { value, goodN: good.length, badN: bad.length };
}
