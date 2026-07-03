type Forecast = {
  id: string;
  question: string;
  desired: boolean;
  resolve_by: string | null;
  resolved: boolean;
  // null for any unresolved forecast — server withholds it, doesn't just hide it (M3 integrity)
  probability: number | null;
  recalled_probability: number | null;
  outcome: boolean | null;
};

export function ForecastTimeline({ forecasts }: { forecasts: Forecast[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Forecasts</h2>

      {forecasts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No forecasts.</p>
      ) : (
        <ul className="space-y-3">
          {forecasts.map((f) => (
            <li key={f.id} className="rounded-md border border-border p-3 space-y-1">
              <p className="text-sm">{f.question}</p>
              <p className="text-xs text-muted-foreground">
                {f.desired ? "desired" : "not desired"}
                {f.resolve_by ? ` · resolves by ${f.resolve_by}` : ""}
              </p>
              {f.resolved ? (
                <p className="font-mono text-xs">
                  recorded p = {f.probability?.toFixed(2)}
                  {f.recalled_probability !== null ? ` · recalled p = ${f.recalled_probability.toFixed(2)}` : ""}
                  {" · outcome = "}
                  {f.outcome === null ? "unresolved" : f.outcome ? "yes" : "no"}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Not yet resolved.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
