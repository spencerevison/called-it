"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createForecast, updateForecast } from "./forecast-actions";

type ForecastFormProps = {
  mode: "create" | "edit";
  decisionId: string;
  forecastId?: string;
  initial?: {
    question: string;
    probability: number;
    desired: boolean;
    resolveBy: string | null;
  };
  onSaved?: () => void;
};

export function ForecastForm({ mode, decisionId, forecastId, initial, onSaved }: ForecastFormProps) {
  const router = useRouter();
  const questionId = useId();
  const probabilityId = useId();
  const desiredId = useId();
  const resolveById = useId();
  const errorId = useId();

  const [probability, setProbability] = useState(initial?.probability ?? 0.5);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setErrors([]);
    formData.set("probability", String(probability));

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createForecast(decisionId, formData)
          : await updateForecast(forecastId!, formData);

      if (!result.ok) {
        setErrors(result.errors);
        return;
      }

      router.refresh();
      onSaved?.();
    });
  }

  return (
    <form className="space-y-3" action={handleSubmit}>
      <div className="space-y-1">
        <label htmlFor={questionId} className="text-sm font-medium">
          Question
        </label>
        <input
          id={questionId}
          name="question"
          type="text"
          required
          defaultValue={initial?.question}
          aria-describedby={errors.length ? errorId : undefined}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={probabilityId} className="text-sm font-medium">
          Probability ({probability.toFixed(2)})
        </label>
        <div className="flex items-center gap-2">
          <input
            id={probabilityId}
            type="range"
            min={0.01}
            max={0.99}
            step={0.01}
            value={probability}
            onChange={(e) => setProbability(Number(e.target.value))}
            className="flex-1"
          />
          <input
            type="number"
            min={0.01}
            max={0.99}
            step={0.01}
            value={probability}
            onChange={(e) => setProbability(Number(e.target.value))}
            aria-label="Probability value"
            aria-describedby={errors.length ? errorId : undefined}
            className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input id={desiredId} name="desired" type="checkbox" defaultChecked={initial?.desired ?? true} />
        <label htmlFor={desiredId} className="text-sm font-medium">
          This is the outcome I want
        </label>
      </div>

      <div className="space-y-1">
        <label htmlFor={resolveById} className="text-sm font-medium">
          Resolve by
        </label>
        <input
          id={resolveById}
          name="resolve_by"
          type="date"
          defaultValue={initial?.resolveBy ?? ""}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      {errors.length > 0 ? (
        <ul id={errorId} role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : mode === "create" ? "Add forecast" : "Save changes"}
      </button>
    </form>
  );
}
