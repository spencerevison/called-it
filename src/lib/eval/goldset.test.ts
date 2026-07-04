import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseGoldsetEntry } from "./goldset";

const EXAMPLE_PATH = path.resolve(__dirname, "..", "..", "..", "goldset", "example-001.json");

describe("parseGoldsetEntry", () => {
  it("parses the committed example entry, dropping the leading-underscore _note key", () => {
    const raw = readFileSync(EXAMPLE_PATH, "utf-8");
    const entry = parseGoldsetEntry(raw, "example-001.json");
    expect(entry.id).toBe("gs-example-001");
    expect(entry).not.toHaveProperty("_note");
    expect(entry.decision.stakes).toBe("medium");
    expect(entry.forecasts).toHaveLength(3);
  });

  it("throws a file-prefixed message on invalid JSON", () => {
    expect(() => parseGoldsetEntry("{ not json", "broken.json")).toThrow(/broken\.json: invalid JSON/);
  });

  it("throws a useful message when a required field is missing or malformed", () => {
    const broken = {
      id: "gs-broken",
      decision: {
        title: "missing most fields",
        // context, rationale, options_considered, chosen_option, decided_on missing
        stakes: "extreme", // not a valid enum member
        reversibility: "two_way",
      },
      forecasts: [{ question: "q", probability: 1.5, desired: true, outcome: true }],
      outcome: { summary: "s", failures: [] },
      human_labels: {
        judge_scores: { risk_comprehensiveness: 1, calibration_given_knowable: 1, process_quality: 1 },
        score_rationales: { risk_comprehensiveness: "r", calibration_given_knowable: "r", process_quality: "r" },
        expected_premortem_risks: [],
      },
    };
    expect(() => parseGoldsetEntry(JSON.stringify(broken), "broken.json")).toThrow(
      /broken\.json: decision\.context/,
    );
  });
});
