import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate from vitest.config.ts on purpose: these specs cover the [HAND]
// metric stubs (M1, M2, M10) and are expected to fail until Spence implements
// them. See loop/TASKS.md T13.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.hand.test.ts"],
    exclude: ["node_modules/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
