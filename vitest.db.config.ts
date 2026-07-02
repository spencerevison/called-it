import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate from vitest.config.ts on purpose: these specs hit a real local
// Supabase instance (`supabase start`) and must never run as part of
// `pnpm check` / CI. See loop/TASKS.md T11.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.db.test.ts"],
    exclude: ["node_modules/**", "e2e/**"],
    globalSetup: ["./src/lib/supabase/test/global-setup.db.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
