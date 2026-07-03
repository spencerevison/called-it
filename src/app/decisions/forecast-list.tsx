"use client";

import { useState } from "react";
import { ForecastForm } from "./forecast-form";

type Forecast = {
  id: string;
  question: string;
  probability: number;
  desired: boolean;
  resolve_by: string | null;
};

export function ForecastList({ decisionId, forecasts }: { decisionId: string; forecasts: Forecast[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Forecasts</h2>

      {forecasts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No forecasts yet.</p>
      ) : (
        <ul className="space-y-3">
          {forecasts.map((f) => (
            <li key={f.id} className="rounded-md border border-border p-3">
              {editingId === f.id ? (
                <ForecastForm
                  mode="edit"
                  decisionId={decisionId}
                  forecastId={f.id}
                  initial={{
                    question: f.question,
                    probability: f.probability,
                    desired: f.desired,
                    resolveBy: f.resolve_by,
                  }}
                  onSaved={() => setEditingId(null)}
                />
              ) : (
                <div className="space-y-1">
                  <p className="text-sm">{f.question}</p>
                  <p className="text-xs text-muted-foreground">
                    p = {f.probability.toFixed(2)} · {f.desired ? "desired" : "not desired"}
                    {f.resolve_by ? ` · resolves by ${f.resolve_by}` : ""}
                  </p>
                  <button type="button" onClick={() => setEditingId(f.id)} className="text-sm text-accent">
                    Edit
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-md border border-border p-3">
        <h3 className="mb-2 text-sm font-medium">Add a forecast</h3>
        <ForecastForm mode="create" decisionId={decisionId} />
      </div>
    </div>
  );
}
