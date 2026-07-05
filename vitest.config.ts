import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // playwright owns e2e/, db-tests/ needs a live supabase (see test:db),
    // eval-smoke/ has its own runner (see test:eval:smoke, T44) — keep all
    // three out of the default vitest test.include net
    exclude: [...configDefaults.exclude, "e2e/**", "db-tests/**", "eval-smoke/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
