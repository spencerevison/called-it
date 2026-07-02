// M8 -- reversal frequency.

export interface ReversalDecision {
  reversed: boolean;
  daysToReversal: number | null; // committed -> first reversed event, only when reversed
}

export interface ReversalFrequencyResult {
  rate: number | null;
  n: number;
  medianDaysToReversal: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function reversalFrequency(decisions: ReversalDecision[]): ReversalFrequencyResult {
  const n = decisions.length;
  if (n === 0) return { rate: null, n, medianDaysToReversal: null };

  const reversed = decisions.filter((d) => d.reversed);
  const days = reversed
    .map((d) => d.daysToReversal)
    .filter((d): d is number => d !== null);

  return {
    rate: reversed.length / n,
    n,
    medianDaysToReversal: median(days),
  };
}
