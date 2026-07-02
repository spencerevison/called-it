import Anthropic from "@anthropic-ai/sdk"

const MODEL = "claude-sonnet-5"

export const ANTHROPIC_MODEL = MODEL

// live path -- only reachable when ANTHROPIC_API_KEY is set; tests inject a mock LlmCaller instead
export async function callAnthropic(system: string, user: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set -- live LLM calls are unavailable")
  }

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  })

  const block = response.content.find((b) => b.type === "text")
  if (!block || block.type !== "text") {
    throw new Error("Anthropic response had no text content")
  }
  return block.text
}
