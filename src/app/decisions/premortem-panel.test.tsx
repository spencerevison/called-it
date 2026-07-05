import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PremortemPanel } from "./premortem-panel";

const generatePremortem = vi.fn().mockResolvedValue({ ok: true, id: "new-premortem" });
const refresh = vi.fn();

vi.mock("./premortem-actions", () => ({
  generatePremortem: (...args: unknown[]) => generatePremortem(...args),
  addUserRisk: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  generatePremortem.mockClear();
  refresh.mockClear();
});

describe("PremortemPanel", () => {
  it("renders the given heading and risks distinctly per instance", () => {
    render(
      <PremortemPanel
        decisionId="d1"
        option="Option A"
        heading="Pre-mortem — Option A (chosen)"
        premortemId="p1"
        risks={[{ id: "r1", description: "runs over budget", category: "execution", severity: "high", source: "ai" }]}
        isDraft
      />,
    );

    expect(screen.getByText("Pre-mortem — Option A (chosen)")).toBeInTheDocument();
    expect(screen.getByText("runs over budget")).toBeInTheDocument();
  });

  it("regenerate calls generatePremortem scoped to this panel's option, not another one's", () => {
    render(
      <PremortemPanel
        decisionId="d1"
        option="Option B"
        heading="Pre-mortem — Option B"
        premortemId="p2"
        risks={[]}
        isDraft
      />,
    );

    fireEvent.click(screen.getByText("Regenerate"));
    expect(generatePremortem).toHaveBeenCalledWith("d1", "Option B");
  });

  it("omits option (legacy whole-decision slot) when none is passed", () => {
    render(<PremortemPanel decisionId="d1" premortemId={null} risks={[]} isDraft />);

    fireEvent.click(screen.getByText("Generate pre-mortem"));
    expect(generatePremortem).toHaveBeenCalledWith("d1", undefined);
  });

  it("blocks add-own-risk once the decision is no longer a draft", () => {
    render(
      <PremortemPanel
        decisionId="d1"
        option="Option A"
        premortemId="p1"
        risks={[{ id: "r1", description: "x", category: "execution", severity: "low", source: "ai" }]}
        isDraft={false}
      />,
    );

    expect(screen.queryByText("Add your own risk")).not.toBeInTheDocument();
    expect(screen.queryByText("Regenerate")).not.toBeInTheDocument();
  });
});
