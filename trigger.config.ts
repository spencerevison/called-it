import { defineConfig } from "@trigger.dev/sdk";

// project ref lives in TRIGGER_PROJECT_ID (see .env.example) — no live key
// checked in
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? "",
  dirs: ["./src/trigger"],
  // compute-time budget per run, not the wait.until duration (durable waits
  // don't count against this)
  maxDuration: 3600,
});
