export type ForecastInput = {
  question: string
  probability: number
  desired: boolean
  resolveBy: string | null
}

export type ForecastFormErrors = Partial<Record<"question" | "probability", string>>

function str(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

// add/edit form -> typed insert/update payload, or field-keyed errors for aria-describedby
export function parseForecastInput(
  formData: FormData,
): { ok: true; value: ForecastInput } | { ok: false; errors: ForecastFormErrors } {
  const errors: ForecastFormErrors = {}

  const question = str(formData, "question")
  if (!question) errors.question = "Question is required."

  const probabilityRaw = str(formData, "probability")
  const probability = Number(probabilityRaw)
  if (!probabilityRaw || Number.isNaN(probability)) {
    errors.probability = "Probability is required."
  } else if (probability < 0.01 || probability > 0.99) {
    errors.probability = "Probability must be between 0.01 and 0.99."
  }

  // checkbox omits the field entirely when unchecked -- absence means false
  const desired = formData.get("desired") !== null

  const resolveByRaw = str(formData, "resolveBy")
  const resolveBy = resolveByRaw === "" ? null : resolveByRaw

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, value: { question, probability, desired, resolveBy } }
}
