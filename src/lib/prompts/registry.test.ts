import { describe, expect, it } from "vitest";
import { parsePromptHeader, planPromptRegistration, PromptDriftError } from "./registry";

const PREMORTEM = `# premortem_v1

kind: premortem
model: claude-sonnet-5
notes: Klein-style prospective hindsight.

---SYSTEM---

body here
`;

describe("parsePromptHeader", () => {
  it("parses id, kind, notes and hashes the raw file", () => {
    const parsed = parsePromptHeader(PREMORTEM, "prompts/premortem_v1.md");
    expect(parsed.id).toBe("premortem_v1");
    expect(parsed.kind).toBe("premortem");
    expect(parsed.notes).toBe("Klein-style prospective hindsight.");
    expect(parsed.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("omits notes when absent", () => {
    const noNotes = `# judge_v1\n\nkind: judge\nmodel: claude-sonnet-5\n\n---SYSTEM---\nbody\n`;
    expect(parsePromptHeader(noNotes, "prompts/judge_v1.md").notes).toBeNull();
  });

  it("throws when the ---SYSTEM--- marker is missing", () => {
    expect(() => parsePromptHeader("# x\nkind: judge\n", "prompts/x.md")).toThrow(
      /missing ---SYSTEM--- marker/,
    );
  });

  it("throws when the id heading is missing", () => {
    expect(() => parsePromptHeader("kind: judge\n\n---SYSTEM---\n", "prompts/x.md")).toThrow(
      /missing "# <id>"/,
    );
  });

  it("throws when the kind line is missing", () => {
    expect(() => parsePromptHeader("# x\n\n---SYSTEM---\n", "prompts/x.md")).toThrow(
      /missing "kind:"/,
    );
  });

  it("two different files hash differently", () => {
    const a = parsePromptHeader(PREMORTEM, "a.md");
    const b = parsePromptHeader(PREMORTEM.replace("body here", "different body"), "b.md");
    expect(a.contentHash).not.toBe(b.contentHash);
  });
});

describe("planPromptRegistration", () => {
  const parsed = [parsePromptHeader(PREMORTEM, "prompts/premortem_v1.md")];

  it("queues a brand-new id for insert", () => {
    expect(planPromptRegistration(parsed, [])).toEqual(parsed);
  });

  it("skips an id whose registered hash still matches", () => {
    const existing = [{ id: "premortem_v1", contentHash: parsed[0].contentHash }];
    expect(planPromptRegistration(parsed, existing)).toEqual([]);
  });

  it("throws PromptDriftError when the file changed under a registered id", () => {
    const existing = [{ id: "premortem_v1", contentHash: "stale-hash" }];
    expect(() => planPromptRegistration(parsed, existing)).toThrow(PromptDriftError);
  });
});
