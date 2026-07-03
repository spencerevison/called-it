"use client";

import { useId, useState, useTransition } from "react";
import { sendMagicLink } from "./actions";

export function LoginForm({ origin, next }: { origin: string; next: string | null }) {
  const emailId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (sent) {
    return <p className="text-sm text-muted-foreground">Check your email for a sign-in link.</p>;
  }

  return (
    <form
      className="space-y-3"
      action={(formData: FormData) => {
        setError(null);
        startTransition(async () => {
          const result = await sendMagicLink(origin, next, formData);
          if (result.ok) {
            setSent(true);
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="space-y-1">
        <label htmlFor={emailId} className="text-sm font-medium">
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-describedby={error ? errorId : undefined}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send magic link"}
      </button>
    </form>
  );
}
