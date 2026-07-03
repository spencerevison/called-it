"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commitDecision } from "./commit-actions";

type CommitPanelProps = {
  decisionId: string;
};

// datetime-local wants "YYYY-MM-DDTHH:mm", local time, no timezone suffix
function toLocalInputValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultCheckinDates() {
  const now = new Date();
  const twoWeeks = new Date(now);
  twoWeeks.setDate(twoWeeks.getDate() + 14);
  const twoMonths = new Date(now);
  twoMonths.setMonth(twoMonths.getMonth() + 2);
  const sixMonths = new Date(now);
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  return {
    twoWeeks: toLocalInputValue(twoWeeks),
    twoMonths: toLocalInputValue(twoMonths),
    sixMonths: toLocalInputValue(sixMonths),
  };
}

export function CommitPanel({ decisionId }: CommitPanelProps) {
  const router = useRouter();
  const twoWeeksId = useId();
  const twoMonthsId = useId();
  const sixMonthsId = useId();
  const errorId = useId();

  // computed once per mount — the point is a sane default the user can edit, not a live clock
  const [defaults] = useState(defaultCheckinDates);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setErrors([]);
    startTransition(async () => {
      const result = await commitDecision(decisionId, formData);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      // no decision list/detail page yet (T27) — home is the only place left to send them
      router.push("/");
    });
  }

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <h2 className="text-sm font-semibold">Commit</h2>
      <p className="text-sm text-muted-foreground">
        Committing locks in the pre-mortem and forecasts and schedules three check-ins. Adjust the
        dates if the defaults don&apos;t fit.
      </p>
      <form className="space-y-4" action={handleSubmit}>
        <div className="space-y-1">
          <label htmlFor={twoWeeksId} className="text-sm font-medium">
            Two-week check-in
          </label>
          <input
            id={twoWeeksId}
            name="two_weeks"
            type="datetime-local"
            required
            defaultValue={defaults.twoWeeks}
            aria-describedby={errors.length ? errorId : undefined}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={twoMonthsId} className="text-sm font-medium">
            Two-month check-in
          </label>
          <input
            id={twoMonthsId}
            name="two_months"
            type="datetime-local"
            required
            defaultValue={defaults.twoMonths}
            aria-describedby={errors.length ? errorId : undefined}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={sixMonthsId} className="text-sm font-medium">
            Six-month check-in
          </label>
          <input
            id={sixMonthsId}
            name="six_months"
            type="datetime-local"
            required
            defaultValue={defaults.sixMonths}
            aria-describedby={errors.length ? errorId : undefined}
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
          {isPending ? "Committing…" : "Commit decision"}
        </button>
      </form>
    </div>
  );
}
