import { Langfuse } from "langfuse"

let cached: Langfuse | null = null

// null when unconfigured -- callers must treat tracing as optional (dev/test envs won't have keys)
export function getLangfuseClient(): Langfuse | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY
  if (!publicKey || !secretKey) return null

  if (!cached) {
    cached = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: process.env.LANGFUSE_BASE_URL,
    })
  }
  return cached
}
