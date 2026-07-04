import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JudgePanel } from "./judge-panel";

const SCORES = { risk_comprehensiveness: 4, calibration_given_knowable: 3, process_quality: 2 };
const RATIONALE = {
  risk_comprehensiveness: "covered execution and external risk",
  calibration_given_knowable: "probabilities tracked stated evidence",
  process_quality: "only one option compared",
};

describe("JudgePanel", () => {
  it("renders nothing when there is no score yet", () => {
    const { container } = render(<JudgePanel judge={null} trusted={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the experimental badge and its reason when not yet trusted", () => {
    render(
      <JudgePanel
        judge={{ scores: SCORES, rationale: RATIONALE, evidenceSpans: ["quote one"] }}
        trusted={false}
      />,
    );
    expect(screen.getByText("Experimental")).toBeInTheDocument();
    expect(screen.getByText(/hasn't yet hit its agreement bar/i)).toBeInTheDocument();
  });

  it("hides the experimental badge once trusted", () => {
    render(
      <JudgePanel
        judge={{ scores: SCORES, rationale: RATIONALE, evidenceSpans: ["quote one"] }}
        trusted={true}
      />,
    );
    expect(screen.queryByText("Experimental")).not.toBeInTheDocument();
  });

  it("renders all three dimension scores, rationale, and evidence spans", () => {
    render(
      <JudgePanel
        judge={{ scores: SCORES, rationale: RATIONALE, evidenceSpans: ["quote one", "quote two"] }}
        trusted={false}
      />,
    );
    expect(screen.getByText("Risk comprehensiveness")).toBeInTheDocument();
    expect(screen.getByText("4 / 5")).toBeInTheDocument();
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    expect(screen.getByText("covered execution and external risk")).toBeInTheDocument();
    expect(screen.getByText(/quote one/)).toBeInTheDocument();
    expect(screen.getByText(/quote two/)).toBeInTheDocument();
  });

  it("puts the achieved anchor text on the score as a tooltip", () => {
    render(
      <JudgePanel
        judge={{ scores: SCORES, rationale: RATIONALE, evidenceSpans: [] }}
        trusted={false}
      />,
    );
    expect(screen.getByTitle(/all material knowable failure modes covered/i)).toBeInTheDocument();
  });
});
