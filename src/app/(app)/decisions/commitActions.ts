"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { parseCommitInput, type CommitFormErrors } from "./commitValidation"

export type CommitFormState = { ok: false; errors: CommitFormErrors } | null

// draft -> active happens in the commit_decision() RPC so it's one transaction
// (status flip + committed event + 3 checkins) -- see supabase/migrations/20260708000000_commit_decision.sql
export async function commitDecision(
  decisionId: string,
  _prev: CommitFormState,
  formData: FormData,
): Promise<CommitFormState> {
  const parsed = parseCommitInput(formData)
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { error } = await supabase.rpc("commit_decision", {
    p_decision_id: decisionId,
    p_checkin_two_weeks: new Date(parsed.value.checkinTwoWeeks).toISOString(),
    p_checkin_two_months: new Date(parsed.value.checkinTwoMonths).toISOString(),
    p_checkin_six_months: new Date(parsed.value.checkinSixMonths).toISOString(),
  })

  if (error) {
    return { ok: false, errors: { checkinTwoWeeks: "Could not commit. Try again." } }
  }

  redirect(`/decisions/${decisionId}/edit`)
}
