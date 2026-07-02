import { RiskCategorySchema, RiskSeveritySchema } from "@/lib/premortem/schema"
import type { z } from "zod"

export type RiskInput = {
  description: string
  category: z.infer<typeof RiskCategorySchema>
  severity: z.infer<typeof RiskSeveritySchema>
}

export type RiskFormErrors = Partial<Record<"description" | "category" | "severity", string>>

function str(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

// user-added risk form -> typed insert payload, or field-keyed errors for aria-describedby
export function parseRiskInput(
  formData: FormData,
): { ok: true; value: RiskInput } | { ok: false; errors: RiskFormErrors } {
  const errors: RiskFormErrors = {}

  const description = str(formData, "description")
  if (!description) errors.description = "Description is required."

  const categoryParsed = RiskCategorySchema.safeParse(str(formData, "category"))
  if (!categoryParsed.success) errors.category = "Choose a category."

  const severityParsed = RiskSeveritySchema.safeParse(str(formData, "severity"))
  if (!severityParsed.success) errors.severity = "Choose a severity."

  if (!categoryParsed.success || !severityParsed.success || Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, value: { description, category: categoryParsed.data, severity: severityParsed.data } }
}
