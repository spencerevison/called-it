import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// thin wrapper so callers/tests never touch the SDK shape directly
export async function generateText(params: {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const response = await getClient().messages.create({
    model: params.model,
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [{ role: "user", content: params.user }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic response contained no text block.");
  }
  return textBlock.text;
}
