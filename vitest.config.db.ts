import { defineConfig } from "vitest/config";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// db-tests hit a real local Supabase instance (requires `supabase start`) —
// kept out of the main vitest.config.ts / pnpm check so CI never needs docker.
// .env.local isn't auto-loaded outside of next dev, so pull it in here.
const envPath = path.resolve(__dirname, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([\w.-]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["db-tests/**/*.test.ts"],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
