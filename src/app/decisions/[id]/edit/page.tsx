import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DecisionForm } from "@/app/decisions/decision-form";

export default async function EditDecisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // RLS (select-own) makes this both the fetch and the ownership check
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, title, context, rationale, options_considered, chosen_option, stakes, reversibility, status")
    .eq("id", id)
    .single();

  if (!decision || decision.status !== "draft") {
    notFound();
  }

  const options = Array.isArray(decision.options_considered)
    ? decision.options_considered.map((option) => String(option))
    : [];

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-lg font-semibold">Edit decision</h1>
      <DecisionForm
        mode="edit"
        decisionId={decision.id}
        initial={{
          title: decision.title,
          context: decision.context,
          rationale: decision.rationale,
          options,
          chosenOption: decision.chosen_option,
          stakes: decision.stakes,
          reversibility: decision.reversibility,
        }}
      />
    </main>
  );
}
