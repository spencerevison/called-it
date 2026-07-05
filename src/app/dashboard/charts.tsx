import type { CalibrationBin, BrierTrendPoint } from "@/lib/metrics/index";

// native SVG, no chart dep — dots are focusable buttons so tooltips work
// for keyboard users, not just hover (T47 AC)

const MIN_N_TO_HIGHLIGHT = 5;

export function CalibrationChart({ bins }: { bins: CalibrationBin[] }) {
  if (bins.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough resolved forecasts yet.</p>;
  }

  return (
    <svg viewBox="0 0 100 100" className="w-full max-w-sm" role="img" aria-label="Calibration curve">
      <line
        x1="0"
        y1="100"
        x2="100"
        y2="0"
        stroke="var(--chart-reference)"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      {bins.map((bin) => {
        const x = bin.meanPredicted * 100;
        const y = 100 - bin.observedFrequency * 100;
        const r = Math.min(2 + Math.sqrt(bin.n), 8);
        const dim = bin.n < MIN_N_TO_HIGHLIGHT;
        return (
          <g key={bin.binStart} className="group" tabIndex={0} focusable="true">
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={dim ? "var(--chart-reference)" : "var(--chart-1)"}
              stroke="var(--surface)"
              strokeWidth="0.5"
            >
              <title>
                {`[${bin.binStart.toFixed(1)}-${bin.binEnd.toFixed(1)}) predicted ${bin.meanPredicted.toFixed(2)}, observed ${bin.observedFrequency.toFixed(2)}, n=${bin.n}`}
              </title>
            </circle>
            <text
              x={x}
              y={Math.max(y - r - 2, 4)}
              textAnchor="middle"
              fontSize="4"
              className="fill-foreground opacity-0 group-focus-within:opacity-100 font-mono"
            >
              {`p=${bin.meanPredicted.toFixed(2)} o=${bin.observedFrequency.toFixed(2)} n=${bin.n}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function BrierTrendChart({ points }: { points: BrierTrendPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough resolved forecasts yet.</p>;
  }

  const step = points.length > 1 ? 100 / (points.length - 1) : 0;
  const coords = points.map((pt, i) => ({ x: i * step, y: 100 - pt.value * 100, pt }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");

  return (
    <svg viewBox="0 0 100 100" className="w-full max-w-sm" role="img" aria-label="Rolling Brier score trend">
      <path d={path} fill="none" stroke="var(--chart-2)" strokeWidth="1" />
      {coords.map(({ x, y, pt }, i) => (
        // resolvedAt isn't unique — two forecasts can resolve at the same instant
        <g key={`${pt.resolvedAt}-${i}`} className="group" tabIndex={0} focusable="true">
          <circle cx={x} cy={y} r="2.5" fill="var(--chart-1)" stroke="var(--surface)" strokeWidth="0.5">
            <title>{`${pt.resolvedAt}: Brier ${pt.value.toFixed(3)} (trailing n=${pt.n})`}</title>
          </circle>
          <text
            x={x}
            y={Math.max(y - 5, 4)}
            textAnchor="middle"
            fontSize="4"
            className="fill-foreground opacity-0 group-focus-within:opacity-100 font-mono"
          >
            {pt.value.toFixed(3)}
          </text>
        </g>
      ))}
    </svg>
  );
}
