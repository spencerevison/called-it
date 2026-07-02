export type DecisionInput = {
  title: string
  context: string
  rationale: string | null
  options: string[]
  chosenOption: string
  stakes: "low" | "medium" | "high"
  reversibility: "one_way" | "two_way"
}

export type DecisionFormErrors = Partial<
  Record<"title" | "context" | "options" | "chosenOption", string>
>

const STAKES = new Set(["low", "medium", "high"])
const REVERSIBILITY = new Set(["one_way", "two_way"])

function str(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

// draft form -> typed insert/update payload, or field-keyed errors for aria-describedby
export function parseDecisionInput(
  formData: FormData,
): { ok: true; value: DecisionInput } | { ok: false; errors: DecisionFormErrors } {
  const errors: DecisionFormErrors = {}

  const title = str(formData, "title")
  if (!title) errors.title = "Title is required."

  const context = str(formData, "context")
  if (!context) errors.context = "Context is required."

  const rationaleRaw = str(formData, "rationale")
  const rationale = rationaleRaw === "" ? null : rationaleRaw

  const options = formData
    .getAll("option")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
  if (options.length < 1) errors.options = "Add at least one option."

  const chosenOption = str(formData, "chosenOption")
  if (!chosenOption) {
    errors.chosenOption = "Choose the option you went with."
  } else if (!options.includes(chosenOption)) {
    errors.chosenOption = "Chosen option must be one of the options above."
  }

  const stakesRaw = str(formData, "stakes")
  const stakes = (STAKES.has(stakesRaw) ? stakesRaw : "medium") as DecisionInput["stakes"]

  const reversibilityRaw = str(formData, "reversibility")
  const reversibility = (
    REVERSIBILITY.has(reversibilityRaw) ? reversibilityRaw : "two_way"
  ) as DecisionInput["reversibility"]

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: { title, context, rationale, options, chosenOption, stakes, reversibility },
  }
}
