import { loadPromptFile, parsePromptFile } from "@/lib/prompts/promptFile"
import { renderTemplate } from "@/lib/prompts/template"

export const PREMORTEM_PROMPT_PATH = "prompts/premortem_v1.md"
export const PREMORTEM_PROMPT_VERSION = "premortem_v1"
// the final scheduled check-in horizon (see DATA_MODEL commit rule) -- prospective hindsight looks that far out
export const PREMORTEM_HORIZON_MONTHS = 6

export type ForecastPromptInput = {
  question: string
  probability: number
  desired: boolean
}

export type DecisionPromptInput = {
  title: string
  context: string
  rationale: string | null
  optionsConsidered: string[]
  chosenOption: string | null
  stakes: string
  reversibility: string
}

export type PremortemPromptInput = {
  decision: DecisionPromptInput
  forecasts: ForecastPromptInput[]
}

export type RenderedPrompt = {
  system: string
  user: string
  frontmatter: Record<string, string>
}

export function renderPremortemPrompt(input: PremortemPromptInput): RenderedPrompt {
  const raw = loadPromptFile(PREMORTEM_PROMPT_PATH)
  return renderPremortemPromptFromRaw(raw, input)
}

// split out from renderPremortemPrompt so tests can pass in a fixture string, no fs
export function renderPremortemPromptFromRaw(
  raw: string,
  input: PremortemPromptInput,
): RenderedPrompt {
  const { frontmatter, system, user } = parsePromptFile(raw)

  const context = {
    horizon_months: PREMORTEM_HORIZON_MONTHS,
    title: input.decision.title,
    context: input.decision.context,
    options_considered: input.decision.optionsConsidered.join(", "),
    chosen_option: input.decision.chosenOption ?? "",
    rationale: input.decision.rationale ?? "",
    stakes: input.decision.stakes,
    reversibility: input.decision.reversibility,
    forecasts: input.forecasts,
  }

  return {
    system: renderTemplate(system, context),
    user: renderTemplate(user, context),
    frontmatter,
  }
}
