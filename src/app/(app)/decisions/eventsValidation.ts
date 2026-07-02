export type ReviseInput = { note: string }
export type ReviseFormErrors = Partial<Record<"note", string>>

export type ReverseInput = { reason: string }
export type ReverseFormErrors = Partial<Record<"reason", string>>

function str(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

// revise = a one-line note describing what changed; DATA_MODEL calls this a
// "payload diff" but we don't attempt a structured diff -- just the note
export function parseReviseInput(
  formData: FormData,
): { ok: true; value: ReviseInput } | { ok: false; errors: ReviseFormErrors } {
  const note = str(formData, "note")
  if (!note) return { ok: false, errors: { note: "Required." } }
  return { ok: true, value: { note } }
}

export function parseReverseInput(
  formData: FormData,
): { ok: true; value: ReverseInput } | { ok: false; errors: ReverseFormErrors } {
  const reason = str(formData, "reason")
  if (!reason) return { ok: false, errors: { reason: "Required." } }
  return { ok: true, value: { reason } }
}
