"use client"

import { useState } from "react"
import { ForecastForm } from "./ForecastForm"

type Forecast = {
  id: string
  question: string
  probability: number
  desired: boolean
  resolve_by: string | null
  resolved: boolean
}

export function ForecastList({ decisionId, forecasts }: { decisionId: string; forecasts: Forecast[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Forecasts</h2>

      {forecasts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No forecasts yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {forecasts.map((forecast) =>
            editingId === forecast.id ? (
              <li key={forecast.id} className="rounded-lg border border-input p-3">
                <ForecastForm decisionId={decisionId} forecast={forecast} />
              </li>
            ) : (
              <li key={forecast.id} className="flex items-center justify-between gap-3 rounded-lg border border-input p-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{forecast.question}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(forecast.probability * 100)}%
                    {forecast.desired ? " · desired" : ""}
                    {forecast.resolve_by ? ` · resolve by ${forecast.resolve_by}` : ""}
                    {forecast.resolved ? " · resolved" : ""}
                  </p>
                </div>
                {!forecast.resolved ? (
                  <button
                    type="button"
                    onClick={() => setEditingId(forecast.id)}
                    className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Edit
                  </button>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}

      <div className="rounded-lg border border-dashed border-input p-3">
        <ForecastForm decisionId={decisionId} />
      </div>
    </div>
  )
}
