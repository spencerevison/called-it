const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  resolved: "Resolved",
  abandoned: "Abandoned",
}

// no dedicated status tokens yet (DESIGN.md Direction section is still TODO) -- reuse the
// severity palette so drafts/active read neutral and terminal states read done/dropped
const STATUS_CLASS: Record<string, string> = {
  draft: "border-muted-foreground text-muted-foreground",
  active: "border-accent text-accent-foreground",
  resolved: "border-positive text-positive",
  abandoned: "border-destructive text-destructive",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CLASS[status] ?? "border-input text-muted-foreground"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}
