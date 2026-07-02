"use client"

import { useActionState, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { generatePremortem, addUserRisk, type RiskActionState } from "./premortemActions"

type Risk = {
  id: string
  description: string
  category: string
  severity: "low" | "medium" | "high"
  source: "ai" | "user"
}

const CATEGORY_LABELS: Record<string, string> = {
  execution: "Execution",
  external: "External",
  information: "Information",
  motivated_reasoning: "Motivated reasoning",
  second_order: "Second-order",
}

const SEVERITY_CLASS: Record<Risk["severity"], string> = {
  high: "border-destructive text-destructive",
  medium: "border-caution text-caution",
  low: "border-muted-foreground text-muted-foreground",
}

const fieldClass =
  "rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const riskInitialState: RiskActionState = null

function SeverityBadge({ severity }: { severity: Risk["severity"] }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_CLASS[severity]}`}>
      {severity}
    </span>
  )
}

function AddRiskForm({ decisionId, premortemId }: { decisionId: string; premortemId: string }) {
  const action = addUserRisk.bind(null, decisionId, premortemId)
  const [state, formAction, pending] = useActionState(action, riskInitialState)
  const errors = state && !state.ok ? state.errors : {}

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-dashed border-input p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium">
          Add your own risk
        </label>
        <input
          id="description"
          name="description"
          aria-describedby={errors.description ? "description-error" : undefined}
          aria-invalid={errors.description ? true : undefined}
          className={`h-9 ${fieldClass}`}
        />
        {errors.description ? (
          <p id="description-error" className="text-sm text-destructive">
            {errors.description}
          </p>
        ) : null}
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="category" className="text-sm font-medium">
            Category
          </label>
          <select id="category" name="category" defaultValue="execution" className={`h-9 ${fieldClass}`}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="severity" className="text-sm font-medium">
            Severity
          </label>
          <select id="severity" name="severity" defaultValue="medium" className={`h-9 ${fieldClass}`}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Adding…" : "Add risk"}
      </Button>
    </form>
  )
}

export function PremortemPanel({
  decisionId,
  status,
  premortemId,
  risks,
}: {
  decisionId: string
  status: "draft" | "active"
  premortemId: string | null
  risks: Risk[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const grouped = risks.reduce<Record<string, Risk[]>>((acc, risk) => {
    ;(acc[risk.category] ??= []).push(risk)
    return acc
  }, {})

  function onGenerate() {
    setError(null)
    startTransition(async () => {
      const result = await generatePremortem(decisionId)
      if (result && !result.ok) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Pre-mortem</h2>
        {status === "draft" ? (
          <Button type="button" variant="secondary" disabled={isPending} onClick={onGenerate}>
            {isPending ? "Generating…" : premortemId ? "Regenerate" : "Generate pre-mortem"}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!premortemId ? (
        <p className="text-sm text-muted-foreground">No pre-mortem yet.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {Object.entries(CATEGORY_LABELS)
            .filter(([category]) => grouped[category]?.length)
            .map(([category, label]) => (
              <div key={category} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
                <ul className="flex flex-col gap-2">
                  {grouped[category].map((risk) => (
                    <li
                      key={risk.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-input p-3"
                    >
                      <p className="text-sm">{risk.description}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        {risk.source === "user" ? (
                          <span className="rounded-full border border-input px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            yours
                          </span>
                        ) : null}
                        <SeverityBadge severity={risk.severity} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

          {status === "draft" ? <AddRiskForm decisionId={decisionId} premortemId={premortemId} /> : null}
        </div>
      )}
    </div>
  )
}
