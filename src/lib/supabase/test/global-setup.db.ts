import { execFileSync } from "node:child_process"

// Pulls URL/keys for the already-running local Supabase instance
// (`supabase start`) so test:db doesn't need a hand-maintained .env.local.
export default function setup() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return

  const out = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
    encoding: "utf8",
  })
  for (const line of out.split("\n")) {
    const match = /^([A-Z_]+)="(.*)"$/.exec(line)
    if (!match) continue
    const [, key, value] = match
    if (key === "API_URL") process.env.NEXT_PUBLIC_SUPABASE_URL = value
    if (key === "ANON_KEY") process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = value
    if (key === "SERVICE_ROLE_KEY") process.env.SUPABASE_SERVICE_ROLE_KEY = value
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      "Could not read local Supabase status -- is `supabase start` running? (pnpm test:db requires it)",
    )
  }
}
