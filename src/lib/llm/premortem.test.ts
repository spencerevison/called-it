import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
vi.mock("./client", () => ({ generateText }));

function risk(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    description: "a specific failure narrative",
    category: "execution",
    severity: "medium",
    likelihood: 0.4,
    ...overrides,
  };
}

function validPayload(count = 6) {
  return JSON.stringify({ risks: Array.from({ length: count }, () => risk()) });
}

describe("parsePremortemResponse", () => {
  it("accepts a well-formed 6-12 risk payload", async () => {
    const { parsePremortemResponse } = await import("./premortem");
    const result = parsePremortemResponse(validPayload(8));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.risks).toHaveLength(8);
  });

  it("rejects malformed JSON", async () => {
    const { parsePremortemResponse } = await import("./premortem");
    const result = parsePremortemResponse("not json");
    expect(result).toEqual({ ok: false, error: "Model response was not valid JSON." });
  });

  it("rejects fewer than 6 risks", async () => {
    const { parsePremortemResponse } = await import("./premortem");
    const result = parsePremortemResponse(validPayload(3));
    expect(result.ok).toBe(false);
  });

  it("rejects more than 12 risks", async () => {
    const { parsePremortemResponse } = await import("./premortem");
    const result = parsePremortemResponse(validPayload(13));
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid category", async () => {
    const { parsePremortemResponse } = await import("./premortem");
    const payload = JSON.stringify({ risks: [risk({ category: "bogus" })] });
    const result = parsePremortemResponse(payload);
    expect(result.ok).toBe(false);
  });
});

describe("generatePremortemRisks", () => {
  beforeEach(() => generateText.mockReset());

  it("returns parsed risks on a clean first response", async () => {
    generateText.mockResolvedValueOnce(validPayload());
    const { generatePremortemRisks } = await import("./premortem");
    const result = await generatePremortemRisks({ model: "claude-sonnet-5", system: "s", user: "u" });
    expect(result.ok).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("retries once after a malformed first response, then succeeds", async () => {
    generateText.mockResolvedValueOnce("not json").mockResolvedValueOnce(validPayload());
    const { generatePremortemRisks } = await import("./premortem");
    const result = await generatePremortemRisks({ model: "claude-sonnet-5", system: "s", user: "u" });
    expect(result.ok).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("errors after a second malformed response", async () => {
    generateText.mockResolvedValueOnce("not json").mockResolvedValueOnce("still not json");
    const { generatePremortemRisks } = await import("./premortem");
    const result = await generatePremortemRisks({ model: "claude-sonnet-5", system: "s", user: "u" });
    expect(result.ok).toBe(false);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  // the transport-throw path (generateText rejects → ok:false) lives in
  // premortem.transport.test.ts: vitest v4 surfaces errors thrown through a vi.fn
  // spy even when caught, so that case uses a plain (non-spy) throwing mock.
});
