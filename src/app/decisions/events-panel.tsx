"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reaffirmDecision, reverseDecision, reviseDecision } from "./event-actions";

export type DecisionEvent = {
  id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
};

const EVENT_LABELS: Record<string, string> = {
  created: "Created",
  committed: "Committed",
  revised: "Revised",
  reversed: "Reversed",
  reaffirmed: "Reaffirmed",
  resolved: "Resolved",
  abandoned: "Abandoned",
};

function noteFromPayload(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "note" in payload) {
    const note = (payload as { note?: unknown }).note;
    return typeof note === "string" ? note : null;
  }
  return null;
}

export function EventsPanel({ decisionId, events }: { decisionId: string; events: DecisionEvent[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [showRevise, setShowRevise] = useState(false);
  const [showReverse, setShowReverse] = useState(false);
  const [isPending, startTransition] = useTransition();

  const noteId = useId();
  const reasonId = useId();
  const errorId = useId();

  function afterAction(result: { ok: true } | { ok: false; errors: string[] }) {
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setShowRevise(false);
    setShowReverse(false);
    router.refresh();
  }

  function handleReaffirm() {
    setErrors([]);
    startTransition(async () => {
      afterAction(await reaffirmDecision(decisionId));
    });
  }

  function handleRevise(formData: FormData) {
    setErrors([]);
    startTransition(async () => {
      afterAction(await reviseDecision(decisionId, formData));
    });
  }

  function handleReverse(formData: FormData) {
    setErrors([]);
    startTransition(async () => {
      afterAction(await reverseDecision(decisionId, formData));
    });
  }

  return (
    <div className="space-y-4 border-t border-border pt-6">
      <h2 className="text-sm font-medium">Events</h2>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const note = noteFromPayload(e.payload);
            return (
              <li key={e.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString()}
                  </span>
                </div>
                {note ? <p className="mt-1 text-muted-foreground">{note}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      {errors.length > 0 ? (
        <ul id={errorId} role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowRevise((v) => !v)}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Revise
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleReaffirm}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Reaffirm
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowReverse((v) => !v)}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Reverse
        </button>
      </div>

      {showRevise ? (
        <form action={handleRevise} className="space-y-2">
          <label htmlFor={noteId} className="text-sm font-medium">
            What changed?
          </label>
          <input
            id={noteId}
            name="note"
            type="text"
            required
            aria-describedby={errors.length ? errorId : undefined}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            Log revision
          </button>
        </form>
      ) : null}

      {showReverse ? (
        <form action={handleReverse} className="space-y-2">
          <label htmlFor={reasonId} className="text-sm font-medium">
            One-line reason for reversing
          </label>
          <input
            id={reasonId}
            name="reason"
            type="text"
            required
            aria-describedby={errors.length ? errorId : undefined}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            Log reversal
          </button>
        </form>
      ) : null}
    </div>
  );
}
