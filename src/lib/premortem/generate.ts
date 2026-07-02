import { PremortemOutputSchema, type PremortemRisk } from "./schema"
import { renderPremortemPrompt, type PremortemPromptInput } from "./prompt"

export type LlmCaller = (system: string, user: string) => Promise<string>

// LLM output isn't always well-formed JSON first try -- retry once, then let it throw
export async function generatePremortemRisks(
  input: PremortemPromptInput,
  callLlm: LlmCaller,
): Promise<PremortemRisk[]> {
  const { system, user } = renderPremortemPrompt(input)

  const attempt = async (): Promise<PremortemRisk[]> => {
    const raw = await callLlm(system, user)
    const parsed = PremortemOutputSchema.parse(JSON.parse(raw))
    return parsed.risks
  }

  try {
    return await attempt()
  } catch {
    return await attempt()
  }
}
