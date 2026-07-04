import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

// T41 fix regression — pins "the CLI's imports resolve under plain node",
// independent of DB/API availability (which is what actually broke: ERR_MODULE_NOT_FOUND
// on the @/ alias + extensionless relative .ts imports, before argv parsing even ran).
describe("eval-judge.mjs", () => {
  it("exits nonzero on bad args without a module resolution error", () => {
    const scriptPath = path.join(__dirname, "eval-judge.mjs");
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
