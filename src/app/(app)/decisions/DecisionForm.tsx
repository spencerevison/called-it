"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { createDecision, updateDecision, type DecisionFormState } from "./actions"

type Decision = {
  id: string
  title: string
  context: string
  rationale: string | null
  options_considered: string[]
  chosen_option: string | null
  stakes: "low" | "medium" | "high"
  reversibility: "one_way" | "two_way"
}

const initialState: DecisionFormState = null

const fieldClass =
  "rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function DecisionForm({ decision }: { decision?: Decision }) {
  const action = decision ? updateDecision.bind(null, decision.id) : createDecision
  const [state, formAction, pending] = useActionState(action, initialState)
  const [options, setOptions] = useState<string[]>(
    decision?.options_considered.length ? decision.options_considered : [""],
  )

  const errors = state && !state.ok ? state.errors : {}
  const nonEmptyOptions = options.map((o) => o.trim()).filter(Boolean)

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)))
  }
  function addOption() {
    setOptions((prev) => [...prev, ""])
  }
  function removeOption(index: number) {
    setOptions((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  return (
    <form action={formAction} className="flex w-full max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={decision?.title}
          aria-describedby={errors.title ? "title-error" : undefined}
          aria-invalid={errors.title ? true : undefined}
          className={`h-9 ${fieldClass}`}
        />
        {errors.title ? (
          <p id="title-error" className="text-sm text-destructive">
            {errors.title}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="context" className="text-sm font-medium">
          Context
        </label>
        <textarea
          id="context"
          name="context"
          defaultValue={decision?.context}
          aria-describedby={errors.context ? "context-error" : undefined}
          aria-invalid={errors.context ? true : undefined}
          className={`min-h-24 py-2 ${fieldClass}`}
        />
        {errors.context ? (
          <p id="context-error" className="text-sm text-destructive">
            {errors.context}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="rationale" className="text-sm font-medium">
          Rationale
        </label>
        <textarea
          id="rationale"
          name="rationale"
          defaultValue={decision?.rationale ?? ""}
          className={`min-h-16 py-2 ${fieldClass}`}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Options considered</legend>
        {options.map((option, i) => (
          <div key={i} className="flex gap-2">
            <label htmlFor={`option-${i}`} className="sr-only">
              Option {i + 1}
            </label>
            <input
              id={`option-${i}`}
              name="option"
              value={option}
              onChange={(e) => updateOption(i, e.target.value)}
              aria-describedby={errors.options ? "options-error" : undefined}
              aria-invalid={errors.options ? true : undefined}
              className={`h-9 flex-1 ${fieldClass}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeOption(i)}
              disabled={options.length <= 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addOption} className="self-start">
          Add option
        </Button>
        {errors.options ? (
          <p id="options-error" className="text-sm text-destructive">
            {errors.options}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="chosenOption" className="text-sm font-medium">
          Chosen option
        </label>
        <select
          id="chosenOption"
          name="chosenOption"
          defaultValue={decision?.chosen_option ?? ""}
          aria-describedby={errors.chosenOption ? "chosenOption-error" : undefined}
          aria-invalid={errors.chosenOption ? true : undefined}
          className={`h-9 ${fieldClass}`}
        >
          <option value="">Select an option</option>
          {nonEmptyOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errors.chosenOption ? (
          <p id="chosenOption-error" className="text-sm text-destructive">
            {errors.chosenOption}
          </p>
        ) : null}
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="stakes" className="text-sm font-medium">
            Stakes
          </label>
          <select id="stakes" name="stakes" defaultValue={decision?.stakes ?? "medium"} className={`h-9 ${fieldClass}`}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="reversibility" className="text-sm font-medium">
            Reversibility
          </label>
          <select
            id="reversibility"
            name="reversibility"
            defaultValue={decision?.reversibility ?? "two_way"}
            className={`h-9 ${fieldClass}`}
          >
            <option value="one_way">One-way (hard to reverse)</option>
            <option value="two_way">Two-way (easy to reverse)</option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={pending} className="mt-2 self-start">
        {pending ? "Saving…" : "Save draft"}
      </Button>
    </form>
  )
}
