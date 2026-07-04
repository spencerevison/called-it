import { randomUUID } from "node:crypto";
import { Langfuse } from "langfuse";

let client: Langfuse | null = null;

function getLangfuseClient(): Langfuse | null {
  if (!process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_PUBLIC_KEY) return null;
  if (!client) {
    client = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL,
    });
  }
  return client;
}

export type LlmTrace = {
  traceId: string;
  end: (output: unknown) => void;
};

// no Langfuse creds configured -> still hand back a trace id so the
// prompt_version + trace id contract holds; there's just nothing to open in langfuse
export function startTrace(params: {
  name: string;
  input: Record<string, unknown>;
  promptVersion: string;
  rubricVersion?: string;
}): LlmTrace {
  const langfuse = getLangfuseClient();
  if (!langfuse) {
    return { traceId: randomUUID(), end: () => {} };
  }

  const trace = langfuse.trace({
    name: params.name,
    input: params.input,
    // JUDGE_RUBRIC §Protocol: judge calls carry rubric_version alongside prompt_version
    metadata: {
      promptVersion: params.promptVersion,
      ...(params.rubricVersion ? { rubricVersion: params.rubricVersion } : {}),
    },
  });

  return {
    traceId: trace.id,
    end: (output: unknown) => {
      trace.update({ output });
      void langfuse.flushAsync();
    },
  };
}
