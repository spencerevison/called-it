"use client";

import { useId, useState, useTransition } from "react";
import { recordRecall, resolveForecast, revealForecast, submitOutcomeNotes } from "@/app/decisions/checkin-actions";

type Forecast = {
  id: string;
  question: string;
  desired: boolean;
  resolved: boolean;
  outcome: boolean | null;
  recalled_probability: number | null;
  revealed_at: string | null;
  probability: number | null;
};

export function CheckinFlow({
  checkinId,
  initialOutcomeNotes,
  forecasts,
}: {
  checkinId: string;
  initialOutcomeNotes: string;
  forecasts: Forecast[];
}) {
  const [notes, setNotes] = useState(initialOutcomeNotes);
  const [notesSaved, setNotesSaved] = useState(false);
  const [rows, setRows] = useState(forecasts);
  const [isPending, startTransition] = useTransition();
  const notesId = useId();

  function saveNotes() {
    startTransition(async () => {
      const result = await submitOutcomeNotes(checkinId, (() => {
        const fd = new FormData();
        fd.set("outcome_notes", notes);
        return fd;
      })());
      setNotesSaved(result.ok);
    });
  }

  function updateRow(id: string, patch: Partial<Forecast>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Outcome notes</h2>
        <label htmlFor={notesId} className="sr-only">
          Outcome notes
        </label>
        <textarea
          id={notesId}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesSaved(false);
          }}
          rows={4}
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
        />
        <button
          type="button"
          onClick={saveNotes}
          disabled={isPending}
          className="rounded-md border border-border px-3 py-1 text-sm"
        >
          Save notes
        </button>
        {notesSaved ? <span className="ml-2 text-xs text-muted-foreground">Saved.</span> : null}
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium">Forecasts</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open forecasts.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((f) => (
              <ForecastRow key={f.id} checkinId={checkinId} forecast={f} onChange={(patch) => updateRow(f.id, patch)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ForecastRow({
  checkinId,
  forecast,
  onChange,
}: {
  checkinId: string;
  forecast: Forecast;
  onChange: (patch: Partial<Forecast>) => void;
}) {
  const [recalled, setRecalled] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const recallId = useId();

  function submitRecall() {
    const value = Number(recalled);
    startTransition(async () => {
      const recallResult = await recordRecall(forecast.id, value);
      if (!recallResult.ok) {
        setError(recallResult.errors[0]);
        return;
      }
      const revealResult = await revealForecast(forecast.id);
      if (!revealResult.ok) {
        setError(revealResult.errors[0]);
        return;
      }
      setError(null);
      onChange({ revealed_at: new Date().toISOString(), recalled_probability: value, probability: revealResult.probability });
    });
  }

  function submitOutcome(outcome: "yes" | "no" | "unresolved") {
    startTransition(async () => {
      const result = await resolveForecast(checkinId, forecast.id, outcome);
      if (!result.ok) {
        setError(result.errors[0]);
        return;
      }
      setError(null);
      if (outcome !== "unresolved") {
        onChange({ resolved: true, outcome: outcome === "yes" });
      }
    });
  }

  if (forecast.resolved) {
    return (
      <li className="rounded-md border border-border p-3 text-sm text-muted-foreground">
        {forecast.question} — resolved {forecast.outcome ? "yes" : "no"}
      </li>
    );
  }

  return (
    <li className="rounded-md border border-border p-3 space-y-2">
      <p className="text-sm">{forecast.question}</p>

      {!forecast.revealed_at ? (
        <div className="space-y-2">
          <label htmlFor={recallId} className="text-xs text-muted-foreground">
            Before you see the recorded probability — what do you recall estimating?
          </label>
          <div className="flex items-center gap-2">
            <input
              id={recallId}
              type="number"
              min="0.01"
              max="0.99"
              step="0.01"
              value={recalled}
              onChange={(e) => setRecalled(e.target.value)}
              className="w-24 rounded-md border border-border bg-background p-1 text-sm"
            />
            <button
              type="button"
              onClick={submitRecall}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-1 text-sm"
            >
              Reveal recorded value
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Recorded: p = {forecast.probability?.toFixed(2)}
            {forecast.recalled_probability !== null ? ` · recalled: ${forecast.recalled_probability.toFixed(2)}` : ""}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => submitOutcome("yes")}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-1 text-sm"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => submitOutcome("no")}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-1 text-sm"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => submitOutcome("unresolved")}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-1 text-sm"
            >
              Can&apos;t resolve yet
            </button>
          </div>
        </div>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </li>
  );
}
