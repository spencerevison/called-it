"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { sendMagicLink, type SendMagicLinkResult } from "./actions"

const initialState: SendMagicLinkResult | null = null

export default function LoginPage() {
  const [result, formAction, pending] = useActionState<SendMagicLinkResult | null, FormData>(
    async (_prev, formData) => sendMagicLink(formData),
    initialState
  )

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background text-foreground">
      <main className="flex w-full max-w-sm flex-col gap-4 px-6 py-32">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Called It</h1>
          <p className="text-muted-foreground">Sign in with a magic link.</p>
        </div>

        {result?.ok ? (
          <p role="status" className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
            Check your email for a sign-in link.
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              aria-describedby={result && !result.ok ? "email-error" : undefined}
              aria-invalid={result && !result.ok ? true : undefined}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {result && !result.ok ? (
              <p id="email-error" className="text-sm text-destructive">
                {result.error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        )}
      </main>
    </div>
  )
}
