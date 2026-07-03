"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generatePremortem, addUserRisk } from "./premortem-actions";

export type RiskCategory = "execution" | "external" | "information" | "motivated_reasoning" | "second_order";
export type RiskSeverity = "low" | "medium" | "high";

export type Risk = {
  id: string;
  description: string;
  category: RiskCategory;
  severity: RiskSeverity;
  source: "ai" | "user";
};

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  execution: "Execution",
  external: "External",
  information: "Information",
  motivated_reasoning: "Motivated reasoning",
  second_order: "Second-order",
};

const CATEGORY_ORDER: RiskCategory[] = Object.keys(CATEGORY_LABELS) as RiskCategory[];

const SEVERITY_STYLES: Record<RiskSeverity, string> = {
  high: "bg-destructive/15 text-destructive",
  medium: "bg-caution/20 text-caution",
  low: "bg-positive/15 text-positive",
};

function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}>{severity}</span>
  );
}

export function PremortemPanel({
  decisionId,
  premortemId,
  risks,
  isDraft,
}: {
  decisionId: string;
  premortemId: string | null;
  risks: Risk[];
  isDraft: boolean;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function regenerate() {
    setErrors([]);
    startTransition(async () => {
      const result = await generatePremortem(decisionId);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      router.refresh();
    });
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    risks: risks.filter((r) => r.category === category),
  })).filter((g) => g.risks.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Pre-mortem</h2>
        {isDraft && (
          <button
            type="button"
            onClick={regenerate}
            disabled={isPending}
            className="text-sm text-accent disabled:opacity-50"
          >
            {premortemId ? "Regenerate" : "Generate pre-mortem"}
          </button>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="text-sm text-destructive" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {premortemId === null ? (
        <p className="text-sm text-muted-foreground">No pre-mortem yet.</p>
      ) : (
        <div className="space-y-4">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">No risks recorded.</p>
          ) : (
            grouped.map((g) => (
              <div key={g.category} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  {CATEGORY_LABELS[g.category]}
                </h3>
                <ul className="space-y-1.5">
                  {g.risks.map((risk) => (
                    <li
                      key={risk.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-border p-2"
                    >
                      <span className="text-sm">
                        {risk.description}
                        {risk.source === "user" && (
                          <span className="ml-1.5 text-xs text-muted-foreground">(added by you)</span>
                        )}
                      </span>
                      <SeverityBadge severity={risk.severity} />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          {isDraft && <AddRiskForm premortemId={premortemId} />}
        </div>
      )}
    </div>
  );
}

function AddRiskForm({ premortemId }: { premortemId: string }) {
  const router = useRouter();
  const descriptionId = useId();
  const categoryId = useId();
  const severityId = useId();
  const errorId = useId();
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setErrors([]);
    startTransition(async () => {
      const result = await addUserRisk(premortemId, formData);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2 rounded-md border border-border p-3">
      <h3 className="text-sm font-medium">Add your own risk</h3>
      <div className="space-y-1">
        <label htmlFor={descriptionId} className="text-xs text-muted-foreground">
          Description
        </label>
        <textarea
          id={descriptionId}
          name="description"
          required
          rows={2}
          aria-describedby={errors.length ? errorId : undefined}
          className="w-full rounded-md border border-border bg-transparent p-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label htmlFor={categoryId} className="text-xs text-muted-foreground">
            Category
          </label>
          <select
            id={categoryId}
            name="category"
            required
            className="w-full rounded-md border border-border bg-transparent p-2 text-sm"
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor={severityId} className="text-xs text-muted-foreground">
            Severity
          </label>
          <select
            id={severityId}
            name="severity"
            required
            className="w-full rounded-md border border-border bg-transparent p-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      {errors.length > 0 && (
        <ul id={errorId} className="text-sm text-destructive" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button type="submit" disabled={isPending} className="text-sm text-accent disabled:opacity-50">
        Add risk
      </button>
    </form>
  );
}
