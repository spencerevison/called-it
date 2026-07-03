import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ForecastTimeline } from "./forecast-timeline";

describe("ForecastTimeline", () => {
  it("keeps the recorded probability out of the DOM for an unresolved forecast", () => {
    const { container } = render(
      <ForecastTimeline
        forecasts={[
          {
            id: "1",
            question: "Will it ship on time?",
            desired: true,
            resolve_by: "2026-01-01",
            resolved: false,
            probability: null,
            recalled_probability: null,
            outcome: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("Will it ship on time?")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/recorded p/);
    expect(screen.getByText("Not yet resolved.")).toBeInTheDocument();
  });

  it("shows recorded probability once resolved", () => {
    render(
      <ForecastTimeline
        forecasts={[
          {
            id: "2",
            question: "Will it ship on time?",
            desired: true,
            resolve_by: "2026-01-01",
            resolved: true,
            probability: 0.7,
            recalled_probability: 0.6,
            outcome: true,
          },
        ]}
      />,
    );

    expect(screen.getByText(/recorded p = 0.70/)).toBeInTheDocument();
    expect(screen.getByText(/recalled p = 0.60/)).toBeInTheDocument();
  });

  it("renders an empty state instead of a blank list", () => {
    render(<ForecastTimeline forecasts={[]} />);
    expect(screen.getByText("No forecasts.")).toBeInTheDocument();
  });
});
