import { z } from "zod"

export const RiskCategorySchema = z.enum([
  "execution",
  "external",
  "information",
  "motivated_reasoning",
  "second_order",
])

export const RiskSeveritySchema = z.enum(["low", "medium", "high"])

export const PremortemRiskSchema = z.object({
  description: z.string().min(1),
  category: RiskCategorySchema,
  severity: RiskSeveritySchema,
  likelihood: z.number().min(0).max(1),
})

// F3 AC: 6-12 distinct risks
export const PremortemOutputSchema = z.object({
  risks: z.array(PremortemRiskSchema).min(6).max(12),
})

export type PremortemRisk = z.infer<typeof PremortemRiskSchema>
export type PremortemOutput = z.infer<typeof PremortemOutputSchema>
