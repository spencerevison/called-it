"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  reaffirmDecision,
  reverseDecision,
  reviseDecision,
  type ReaffirmFormState,
  type ReverseFormState,
  type ReviseFormState,
} from "./eventsActions"

const fieldClass =
  "rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const EVENT_LABEL: Record<string, string> = {
  created: "Created",
  committed: "Committed",
  revised: "Revised",
  reversed: "Reversed",
  reaffirmed: "Reaffirmed",
  resolved: "Resolved",
  abandoned: "Abandoned",
}

export type DecisionEvent = {
  id: string
  event_type: string
  payload: { note?: string; reason?: string }
  created_at: string
}

function RevisePanel({ decisionId }: { decisionId: string }) {
  const action = reviseDecision.bind(null, decisionId)
  const [state, formAction, pending] = useActionState<ReviseFormState, FormData>(action, null)
  const errors = state && !state.ok ? state.errors : {}

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <label htmlFor="revise-note" className="text-sm font-medium">
        Log a revision note
      </label>
      <textarea
        id="revise-note"
        name="note"
        rows={2}
        placeholder="What changed and why, in one line"
        aria-describedby={errors.note ? "revise-note-error" : undefined}
        aria-invalid={errors.note ? true : undefined}
        className={fieldClass}
      />
      {errors.note ? (
        <p id="revise-note-error" className="text-sm text-destructive">
          {errors.note}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} variant="outline" className="self-start">
        {pending ? "Saving…" : "Log revision"}
      </Button>
    </form>
  )
}

function ReversePanel({ decisionId }: { decisionId: string }) {
  const [open, setOpen] = useState(false)
  const action = reverseDecision.bind(null, decisionId)
  const [state, formAction, pending] = useActionState<ReverseFormState, FormData>(action, null)
  const errors = state && !state.ok ? state.errors : {}

  if (!open) {
    return (
      <Button type="button" variant="outline" className="self-start" onClick={() => setOpen(true)}>
        Reverse decision
      </Button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <label htmlFor="reverse-reason" className="text-sm font-medium">
        Reason for reversing (one line)
      </label>
      <textarea
        id="reverse-reason"
        name="reason"
        rows={2}
        aria-describedby={errors.reason ? "reverse-reason-error" : undefined}
        aria-invalid={errors.reason ? true : undefined}
        className={fieldClass}
      />
      {errors.reason ? (
        <p id="reverse-reason-error" className="text-sm text-destructive">
          {errors.reason}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} variant="destructive" className="self-start">
        {pending ? "Saving…" : "Confirm reversal"}
      </Button>
    </form>
  )
}

function ReaffirmPanel({ decisionId }: { decisionId: string }) {
  const action = reaffirmDecision.bind(null, decisionId)
  const [, formAction, pending] = useActionState<ReaffirmFormState, FormData>(action, null)

  return (
    <form action={formAction}>
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? "Saving…" : "Reaffirm decision"}
      </Button>
    </form>
  )
}

export function DecisionEventsPanel({
  decisionId,
  events,
  active,
}: {
  decisionId: string
  events: DecisionEvent[]
  active: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Events</h2>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-0.5 rounded-lg border border-input p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{EVENT_LABEL[event.event_type] ?? event.event_type}</span>
                <span className="text-muted-foreground">{new Date(event.created_at).toLocaleDateString()}</span>
              </div>
              {event.payload.note ? <p className="text-muted-foreground">{event.payload.note}</p> : null}
              {event.payload.reason ? <p className="text-muted-foreground">{event.payload.reason}</p> : null}
            </li>
          ))}
        </ol>
      )}

      {active ? (
        <div className="flex flex-col gap-4 rounded-lg border border-input p-4">
          <RevisePanel decisionId={decisionId} />
          <ReversePanel decisionId={decisionId} />
          <ReaffirmPanel decisionId={decisionId} />
        </div>
      ) : null}
    </div>
  )
}
