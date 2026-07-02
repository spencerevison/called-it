"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { createForecast, updateForecast, type ForecastFormState } from "./forecastActions"

type Forecast = {
  id: string
  question: string
  probability: number
  desired: boolean
  resolve_by: string | null
}

const initialState: ForecastFormState = null

const fieldClass =
  "rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function ForecastForm({
  decisionId,
  forecast,
}: {
  decisionId: string
  forecast?: Forecast
}) {
  const action = forecast
    ? updateForecast.bind(null, decisionId, forecast.id)
    : createForecast.bind(null, decisionId)
  const [state, formAction, pending] = useActionState(action, initialState)
  const [probability, setProbability] = useState(forecast?.probability ?? 0.5)

  const errors = state && !state.ok ? state.errors : {}

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="question" className="text-sm font-medium">
          Question
        </label>
        <input
          id="question"
          name="question"
          defaultValue={forecast?.question}
          aria-describedby={errors.question ? "question-error" : undefined}
          aria-invalid={errors.question ? true : undefined}
          className={`h-9 ${fieldClass}`}
        />
        {errors.question ? (
          <p id="question-error" className="text-sm text-destructive">
            {errors.question}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="probability" className="text-sm font-medium">
          Probability
        </label>
        <div className="flex items-center gap-3">
          {/* native range input -- no need for a slider dependency */}
          <input
            type="range"
            id="probability"
            min={0.01}
            max={0.99}
            step={0.01}
            value={probability}
            onChange={(e) => setProbability(Number(e.target.value))}
            className="flex-1"
          />
          <input
            type="number"
            name="probability"
            min={0.01}
            max={0.99}
            step={0.01}
            value={probability}
            onChange={(e) => setProbability(Number(e.target.value))}
            aria-describedby={errors.probability ? "probability-error" : undefined}
            aria-invalid={errors.probability ? true : undefined}
            className={`h-9 w-24 ${fieldClass}`}
          />
        </div>
        {errors.probability ? (
          <p id="probability-error" className="text-sm text-destructive">
            {errors.probability}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="desired"
          name="desired"
          defaultChecked={forecast?.desired ?? true}
          className="size-4"
        />
        <label htmlFor="desired" className="text-sm font-medium">
          This is the outcome I want
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="resolveBy" className="text-sm font-medium">
          Resolve by
        </label>
        <input
          type="date"
          id="resolveBy"
          name="resolveBy"
          defaultValue={forecast?.resolve_by ?? ""}
          className={`h-9 ${fieldClass}`}
        />
      </div>

      <Button type="submit" disabled={pending} className="mt-1 self-start">
        {pending ? "Saving…" : forecast ? "Save forecast" : "Add forecast"}
      </Button>
    </form>
  )
}
