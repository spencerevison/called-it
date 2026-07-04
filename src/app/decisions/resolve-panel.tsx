"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveDecision } from "./resolve-actions";

// shared between the decision detail page and the check-in flow page (T35 AC:
// resolution must be reachable from either) -- only rendered while active
export function ResolvePanel({ decisionId }: { decisionId: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function submit(status: "resolved" | "abandoned") {
    setErrors([]);
    startTransition(async () => {
      const result = await resolveDecision(decisionId, status);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 border-t border-border pt-6">
      <h2 className="text-sm font-medium">Resolve this decision</h2>
      <p className="text-xs text-muted-foreground">
        Marks the decision terminal and skips any remaining check-ins.
      </p>
      {errors.length > 0 ? (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit("resolved")}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          Resolve
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit("abandoned")}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Abandon
        </button>
      </div>
    </div>
  );
}
