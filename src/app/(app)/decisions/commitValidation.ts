export type CommitInput = {
  checkinTwoWeeks: string
  checkinTwoMonths: string
  checkinSixMonths: string
}

export type CommitFormErrors = Partial<
  Record<"checkinTwoWeeks" | "checkinTwoMonths" | "checkinSixMonths", string>
>

function str(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

// commit form (3 editable check-in dates) -> typed RPC payload, or field-keyed errors
export function parseCommitInput(
  formData: FormData,
): { ok: true; value: CommitInput } | { ok: false; errors: CommitFormErrors } {
  const errors: CommitFormErrors = {}

  const checkinTwoWeeks = str(formData, "checkinTwoWeeks")
  if (!checkinTwoWeeks) errors.checkinTwoWeeks = "Required."

  const checkinTwoMonths = str(formData, "checkinTwoMonths")
  if (!checkinTwoMonths) errors.checkinTwoMonths = "Required."

  const checkinSixMonths = str(formData, "checkinSixMonths")
  if (!checkinSixMonths) errors.checkinSixMonths = "Required."

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, value: { checkinTwoWeeks, checkinTwoMonths, checkinSixMonths } }
}
