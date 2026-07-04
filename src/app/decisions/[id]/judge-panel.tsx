import { JUDGE_RUBRIC_DIMENSIONS, anchorFor } from "@/lib/llm/judge-rubric";
import type { JudgeDimension } from "@/lib/llm/judge";

type Judge = {
  scores: Record<JudgeDimension, number>;
  rationale: Record<JudgeDimension, string>;
  evidenceSpans: string[];
};

export function JudgePanel({ judge, trusted }: { judge: Judge | null; trusted: boolean }) {
  if (!judge) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Judge scores</h2>
        {!trusted ? (
          <span
            className="rounded bg-caution/20 px-1.5 py-0.5 text-xs font-medium text-caution"
            title="Scores hide behind this badge until the judge clears its gold-set agreement bar (EVAL_PLAN.md §4)."
          >
            Experimental
          </span>
        ) : null}
      </div>
      {!trusted ? (
        <p className="text-xs text-muted-foreground">
          This judge hasn&apos;t yet hit its agreement bar against the human-labeled gold set, so treat these
          scores as a work in progress.
        </p>
      ) : null}

      <ul className="space-y-3">
        {JUDGE_RUBRIC_DIMENSIONS.map((dim) => {
          const score = judge.scores[dim.key];
          return (
            <li key={dim.key} className="rounded-md border border-border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm">{dim.label}</span>
                <span className="font-mono text-xs" title={anchorFor(dim.key, score)}>
                  {score} / 5
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{judge.rationale[dim.key]}</p>
            </li>
          );
        })}
      </ul>

      {judge.evidenceSpans.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground">Evidence</h3>
          <ul className="space-y-1">
            {judge.evidenceSpans.map((span) => (
              <li key={span} className="text-xs italic text-muted-foreground">
                “{span}”
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
