import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { StatusBadge } from "./StatusBadge"

const STATUSES = ["draft", "active", "resolved", "abandoned"] as const
type Status = (typeof STATUSES)[number]

function isStatus(value: string | undefined): value is Status {
  return STATUSES.includes(value as Status)
}

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const filter = isStatus(status) ? status : undefined

  const supabase = await createClient()
  let query = supabase
    .from("decisions")
    .select("id, title, status, stakes, created_at")
    .order("created_at", { ascending: false })
  if (filter) query = query.eq("status", filter)

  const { data: decisions } = await query

  return (
    <div className="flex flex-1 flex-col items-center bg-background text-foreground">
      <main className="flex w-full max-w-lg flex-col gap-6 px-6 py-12">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
          <Link href="/decisions/new" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
            New decision
          </Link>
        </div>

        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/decisions"
            className={`rounded-full border px-2.5 py-0.5 ${!filter ? "border-primary text-primary" : "border-input text-muted-foreground"}`}
          >
            All
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/decisions?status=${s}`}
              className={`rounded-full border px-2.5 py-0.5 capitalize ${filter === s ? "border-primary text-primary" : "border-input text-muted-foreground"}`}
            >
              {s}
            </Link>
          ))}
        </nav>

        {!decisions || decisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filter ? `No ${filter} decisions yet.` : "No decisions yet — start by recording one."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {decisions.map((decision) => (
              <li key={decision.id}>
                <Link
                  href={decision.status === "draft" ? `/decisions/${decision.id}/edit` : `/decisions/${decision.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-input p-3 hover:border-ring"
                >
                  <span className="text-sm font-medium">{decision.title}</span>
                  <StatusBadge status={decision.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
