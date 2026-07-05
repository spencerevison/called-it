import { defineConfig } from "vitest/config";
import path from "node:path";

// T44 — CI eval smoke runs in its own vitest project so it stays out of
// `pnpm check` (mirrors vitest.config.db.ts's reasoning, different constraint:
// this one *could* run under the main config, it's just scoped separately per the AC).
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["eval-smoke/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
