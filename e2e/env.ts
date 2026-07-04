import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// e2e specs run as plain node/playwright, outside Next's own .env.local
// loading (that only covers the spawned `pnpm dev` child) — pull it in here
// too so a spec can talk to Supabase directly via the service-role key.
// Same manual parse as vitest.config.db.ts, same reason.
const envPath = path.resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([\w.-]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}
