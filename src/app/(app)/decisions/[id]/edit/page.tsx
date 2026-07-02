import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DecisionForm } from "../../DecisionForm"

export default async function EditDecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // RLS already scopes this to the caller's own rows -- no id belongs to a stranger
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, title, context, rationale, options_considered, chosen_option, stakes, reversibility, status")
    .eq("id", id)
    .single()

  if (!decision || decision.status !== "draft") {
    notFound()
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-background text-foreground">
      <main className="flex w-full max-w-lg flex-col gap-4 px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Edit decision</h1>
        <DecisionForm
          decision={{
            id: decision.id,
            title: decision.title,
            context: decision.context,
            rationale: decision.rationale,
            options_considered: Array.isArray(decision.options_considered)
              ? (decision.options_considered as string[])
              : [],
            chosen_option: decision.chosen_option,
            stakes: decision.stakes,
            reversibility: decision.reversibility,
          }}
        />
      </main>
    </div>
  )
}
