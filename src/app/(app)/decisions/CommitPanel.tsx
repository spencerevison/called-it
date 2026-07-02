"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { commitDecision, type CommitFormState } from "./commitActions"

const fieldClass =
  "rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const initialState: CommitFormState = null

function defaultDate(addMonths: number, addDays = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + addMonths)
  d.setDate(d.getDate() + addDays)
  return d.toISOString().slice(0, 10)
}

export function CommitPanel({ decisionId }: { decisionId: string }) {
  const action = commitDecision.bind(null, decisionId)
  const [state, formAction, pending] = useActionState(action, initialState)
  const errors = state && !state.ok ? state.errors : {}

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-input p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Commit</h2>
        <p className="text-sm text-muted-foreground">
          Locks the decision as active and schedules three check-ins. Dates below are editable.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="checkinTwoWeeks" className="text-sm font-medium">
            Check in at 2 weeks
          </label>
          <input
            type="date"
            id="checkinTwoWeeks"
            name="checkinTwoWeeks"
            defaultValue={defaultDate(0, 14)}
            aria-describedby={errors.checkinTwoWeeks ? "checkinTwoWeeks-error" : undefined}
            aria-invalid={errors.checkinTwoWeeks ? true : undefined}
            className={`h-9 ${fieldClass}`}
          />
          {errors.checkinTwoWeeks ? (
            <p id="checkinTwoWeeks-error" className="text-sm text-destructive">
              {errors.checkinTwoWeeks}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="checkinTwoMonths" className="text-sm font-medium">
            Check in at 2 months
          </label>
          <input
            type="date"
            id="checkinTwoMonths"
            name="checkinTwoMonths"
            defaultValue={defaultDate(2)}
            aria-describedby={errors.checkinTwoMonths ? "checkinTwoMonths-error" : undefined}
            aria-invalid={errors.checkinTwoMonths ? true : undefined}
            className={`h-9 ${fieldClass}`}
          />
          {errors.checkinTwoMonths ? (
            <p id="checkinTwoMonths-error" className="text-sm text-destructive">
              {errors.checkinTwoMonths}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="checkinSixMonths" className="text-sm font-medium">
            Check in at 6 months
          </label>
          <input
            type="date"
            id="checkinSixMonths"
            name="checkinSixMonths"
            defaultValue={defaultDate(6)}
            aria-describedby={errors.checkinSixMonths ? "checkinSixMonths-error" : undefined}
            aria-invalid={errors.checkinSixMonths ? true : undefined}
            className={`h-9 ${fieldClass}`}
          />
          {errors.checkinSixMonths ? (
            <p id="checkinSixMonths-error" className="text-sm text-destructive">
              {errors.checkinSixMonths}
            </p>
          ) : null}
        </div>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Committing…" : "Commit decision"}
        </Button>
      </form>
    </div>
  )
}
