"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDecision, updateDecision } from "./actions";

type Stakes = "low" | "medium" | "high";
type Reversibility = "one_way" | "two_way";

type DecisionFormProps = {
  mode: "create" | "edit";
  decisionId?: string;
  initial?: {
    title: string;
    context: string;
    rationale: string | null;
    options: string[];
    chosenOption: string | null;
    stakes: Stakes;
    reversibility: Reversibility;
  };
};

export function DecisionForm({ mode, decisionId, initial }: DecisionFormProps) {
  const router = useRouter();
  const titleId = useId();
  const contextId = useId();
  const rationaleId = useId();
  const stakesId = useId();
  const reversibilityId = useId();
  const errorId = useId();

  const [options, setOptions] = useState<string[]>(
    initial?.options.length ? initial.options : [""],
  );
  const [chosenOption, setChosenOption] = useState(initial?.chosenOption ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateOption(index: number, value: string) {
    setOptions((prev) => {
      const prevValue = prev[index];
      if (chosenOption === prevValue) setChosenOption(value);
      return prev.map((opt, i) => (i === index ? value : opt));
    });
  }

  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(index: number) {
    setOptions((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev[index];
      if (chosenOption === removed) setChosenOption("");
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleSubmit(formData: FormData) {
    setErrors([]);
    setSaved(false);
    options.forEach((opt) => formData.append("options", opt));
    formData.set("chosen_option", chosenOption);

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createDecision(formData)
          : await updateDecision(decisionId!, formData);

      if (!result.ok) {
        setErrors(result.errors);
        return;
      }

      if (mode === "create") {
        router.push(`/decisions/${result.id}/edit`);
      } else {
        router.refresh();
        setSaved(true);
      }
    });
  }

  return (
    <form className="space-y-4" action={handleSubmit}>
      <div className="space-y-1">
        <label htmlFor={titleId} className="text-sm font-medium">
          Title
        </label>
        <input
          id={titleId}
          name="title"
          type="text"
          required
          defaultValue={initial?.title}
          aria-describedby={errors.length ? errorId : undefined}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={contextId} className="text-sm font-medium">
          Context
        </label>
        <textarea
          id={contextId}
          name="context"
          required
          rows={3}
          defaultValue={initial?.context}
          aria-describedby={errors.length ? errorId : undefined}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={rationaleId} className="text-sm font-medium">
          Rationale
        </label>
        <textarea
          id={rationaleId}
          name="rationale"
          rows={3}
          defaultValue={initial?.rationale ?? ""}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Options considered</legend>
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="radio"
              aria-label={`Chosen option ${index + 1}`}
              checked={option.length > 0 && option === chosenOption}
              disabled={option.length === 0}
              onChange={() => setChosenOption(option)}
            />
            <input
              type="text"
              required
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              aria-describedby={errors.length ? errorId : undefined}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => removeOption(index)}
              disabled={options.length <= 1}
              className="text-sm text-muted-foreground disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addOption} className="text-sm text-accent">
          Add option
        </button>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor={stakesId} className="text-sm font-medium">
          Stakes
        </label>
        <select
          id={stakesId}
          name="stakes"
          defaultValue={initial?.stakes ?? "medium"}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor={reversibilityId} className="text-sm font-medium">
          Reversibility
        </label>
        <select
          id={reversibilityId}
          name="reversibility"
          defaultValue={initial?.reversibility ?? "two_way"}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="one_way">One-way (hard to undo)</option>
          <option value="two_way">Two-way (reversible)</option>
        </select>
      </div>

      {errors.length > 0 ? (
        <ul id={errorId} role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      {saved ? <p className="text-sm text-muted-foreground">Saved.</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : mode === "create" ? "Save draft" : "Save changes"}
      </button>
    </form>
  );
}
