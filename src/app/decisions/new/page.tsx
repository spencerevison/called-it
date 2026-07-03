import { DecisionForm } from "@/app/decisions/decision-form";

export default function NewDecisionPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-lg font-semibold">New decision</h1>
      <DecisionForm mode="create" />
    </main>
  );
}
