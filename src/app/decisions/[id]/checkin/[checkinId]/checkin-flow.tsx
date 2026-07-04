"use client";

import { useId, useState, useTransition } from "react";
import {
  addCheckinFailure,
  completeCheckin,
  recordRecall,
  resolveForecast,
  revealForecast,
  submitOutcomeNotes,
} from "@/app/decisions/checkin-actions";

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

type Risk = { id: string; description: string };

type Attribution = "skill" | "luck" | "mixed";

type Failure = {
  id: string;
  description: string;
  linked_risk_id: string | null;
  was_knowable: boolean;
  attribution: Attribution;
};

export function CheckinFlow({
  checkinId,
  initialOutcomeNotes,
  forecasts,
  risks,
  initialFailures,
  initialCompleted,
}: {
  checkinId: string;
  initialOutcomeNotes: string;
  forecasts: Forecast[];
  risks: Risk[];
  initialFailures: Failure[];
  initialCompleted: boolean;
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

  const [failures, setFailures] = useState(initialFailures);
  const [completed, setCompleted] = useState(initialCompleted);

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

      <div className="space-y-4">
        <h2 className="text-sm font-medium">What went wrong</h2>
        {failures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No failures logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {failures.map((f) => {
              const risk = risks.find((r) => r.id === f.linked_risk_id);
              return (
                <li key={f.id} className="rounded-md border border-border p-3 text-sm">
                  <p>{f.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {risk ? `linked: ${risk.description}` : "unlisted"} · {f.was_knowable ? "knowable" : "not knowable"} ·{" "}
                    {f.attribution}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {!completed ? (
          <FailureForm
            checkinId={checkinId}
            risks={risks}
            onAdded={(failure) => setFailures((prev) => [...prev, failure])}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Complete check-in</h2>
        {completed ? (
          <p className="text-sm text-muted-foreground">This check-in is complete.</p>
        ) : (
          <CompleteForm checkinId={checkinId} onCompleted={() => setCompleted(true)} />
        )}
      </div>
    </div>
  );
}

function FailureForm({
  checkinId,
  risks,
  onAdded,
}: {
  checkinId: string;
  risks: Risk[];
  onAdded: (failure: Failure) => void;
}) {
  const [description, setDescription] = useState("");
  const [linkedRiskId, setLinkedRiskId] = useState("unlisted");
  const [wasKnowable, setWasKnowable] = useState(true);
  const [attribution, setAttribution] = useState<Attribution>("skill");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const descId = useId();

  function submit() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("description", description);
      fd.set("linked_risk_id", linkedRiskId);
      if (wasKnowable) fd.set("was_knowable", "on");
      fd.set("attribution", attribution);

      const result = await addCheckinFailure(checkinId, fd);
      if (!result.ok) {
        setError(result.errors[0]);
        return;
      }
      setError(null);
      onAdded({
        // client-only id for list keys -- the row itself has no round-trip id to echo back
        id: `local-${Date.now()}-${description}`,
        description,
        linked_risk_id: linkedRiskId === "unlisted" ? null : linkedRiskId,
        was_knowable: wasKnowable,
        attribution,
      });
      setDescription("");
      setLinkedRiskId("unlisted");
      setWasKnowable(true);
      setAttribution("skill");
    });
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <label htmlFor={descId} className="text-xs text-muted-foreground">
        What happened?
      </label>
      <textarea
        id={descId}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-border bg-background p-2 text-sm"
      />

      <select
        value={linkedRiskId}
        onChange={(e) => setLinkedRiskId(e.target.value)}
        className="w-full rounded-md border border-border bg-background p-1 text-sm"
      >
        <option value="unlisted">Unlisted (the pre-mortem missed it)</option>
        {risks.map((r) => (
          <option key={r.id} value={r.id}>
            {r.description}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={wasKnowable} onChange={(e) => setWasKnowable(e.target.checked)} />
        Knowable at decision time
      </label>

      <select
        value={attribution}
        onChange={(e) => setAttribution(e.target.value as Attribution)}
        className="w-full rounded-md border border-border bg-background p-1 text-sm"
      >
        <option value="skill">Skill</option>
        <option value="luck">Luck</option>
        <option value="mixed">Mixed</option>
      </select>

      <button
        type="button"
        onClick={submit}
        disabled={isPending || !description.trim()}
        className="rounded-md border border-border px-3 py-1 text-sm"
      >
        Add failure
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function CompleteForm({ checkinId, onCompleted }: { checkinId: string; onCompleted: () => void }) {
  const [attribution, setAttribution] = useState<Attribution>("skill");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("overall_attribution", attribution);
      const result = await completeCheckin(checkinId, fd);
      if (!result.ok) {
        setError(result.errors[0]);
        return;
      }
      setError(null);
      onCompleted();
    });
  }

  return (
    <div className="space-y-2">
      <select
        value={attribution}
        onChange={(e) => setAttribution(e.target.value as Attribution)}
        className="w-full max-w-xs rounded-md border border-border bg-background p-1 text-sm"
      >
        <option value="skill">Skill</option>
        <option value="luck">Luck</option>
        <option value="mixed">Mixed</option>
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="rounded-md border border-border px-3 py-1 text-sm"
      >
        Complete check-in
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
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
