import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Status = Database["public"]["Enums"]["decision_status"];

const FILTERS: { label: string; value: Status | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Resolved", value: "resolved" },
  { label: "Abandoned", value: "abandoned" },
];

const EMPTY_COPY: Record<Status | "all", string> = {
  all: "No decisions yet. Start one to see it here.",
  draft: "No drafts in progress.",
  active: "Nothing committed yet — commit a draft to start tracking it.",
  resolved: "No decisions resolved yet.",
  abandoned: "No decisions abandoned.",
};

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const activeFilter = FILTERS.some((f) => f.value === statusParam)
    ? (statusParam as Status | "all")
    : "all";

  const supabase = await createClient();
  let query = supabase
    .from("decisions")
    .select("id, title, status, stakes, created_at")
    .order("created_at", { ascending: false });

  if (activeFilter !== "all") {
    query = query.eq("status", activeFilter);
  }

  const { data: decisions } = await query;

  return (
    <main className="mx-auto max-w-xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Decisions</h1>
        <Link href="/decisions/new" className="text-sm text-accent">
          New decision
        </Link>
      </div>

      <nav className="flex gap-3 border-b border-border text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/decisions" : `/decisions?status=${f.value}`}
            className={`pb-2 ${
              activeFilter === f.value
                ? "border-b-2 border-accent font-medium text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {!decisions || decisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_COPY[activeFilter]}</p>
      ) : (
        <ul className="space-y-3">
          {decisions.map((d) => (
            <li key={d.id}>
              <Link
                href={d.status === "draft" ? `/decisions/${d.id}/edit` : `/decisions/${d.id}`}
                className="flex items-center justify-between rounded-md border border-border p-3 hover:border-accent"
              >
                <span className="text-sm">{d.title}</span>
                <span className="text-xs text-muted-foreground">{d.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
