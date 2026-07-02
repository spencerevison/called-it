import { DecisionForm } from "../DecisionForm"

export default function NewDecisionPage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-background text-foreground">
      <main className="flex w-full max-w-lg flex-col gap-4 px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">New decision</h1>
        <DecisionForm />
      </main>
    </div>
  )
}
