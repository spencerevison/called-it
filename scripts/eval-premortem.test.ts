import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

// mirrors eval-judge.test.ts's regression — pins that the CLI's imports
// resolve under plain node (the @/ alias + extensionless .ts imports),
// independent of DB/API availability.
describe("eval-premortem.mjs", () => {
  it("exits nonzero on bad args without a module resolution error", () => {
    const scriptPath = path.join(__dirname, "eval-premortem.mjs");
    const loaderPath = path.join(__dirname, "ts-alias-loader.mjs");

    let stderr = "";
    let status = 0;
    try {
      execFileSync(process.execPath, ["--import", loaderPath, scriptPath], { stdio: "pipe" });
    } catch (err) {
      const e = err as { stderr?: Buffer; status?: number };
      stderr = e.stderr?.toString() ?? "";
      status = e.status ?? 1;
    }

    expect(status).not.toBe(0);
    expect(stderr).not.toContain("ERR_MODULE_NOT_FOUND");
  });
});
