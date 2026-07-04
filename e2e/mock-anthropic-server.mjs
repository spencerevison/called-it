// Stand-in for api.anthropic.com during the T36 e2e run — the Anthropic SDK
// reads ANTHROPIC_BASE_URL, so pointing it here keeps the pre-mortem step
// off the network entirely. Started as its own playwright webServer entry.
import http from "node:http";

const PORT = Number(process.env.MOCK_ANTHROPIC_PORT || 4010);

const risks = [
  { description: "e2e mock risk: launch has no owner once shipped", category: "execution", severity: "high", likelihood: 0.6 },
  { description: "e2e mock risk: a competitor ships the same thing first", category: "external", severity: "medium", likelihood: 0.4 },
  { description: "e2e mock risk: the cost estimate was never verified", category: "information", severity: "medium", likelihood: 0.5 },
  { description: "e2e mock risk: assumed demand without asking any users", category: "motivated_reasoning", severity: "low", likelihood: 0.3 },
  { description: "e2e mock risk: success here breaks an adjacent team's plan", category: "second_order", severity: "low", likelihood: 0.2 },
  { description: "e2e mock risk: rollout slips past the holiday freeze", category: "execution", severity: "medium", likelihood: 0.45 },
];

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/v1/messages") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "msg_e2e_mock",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5",
        content: [{ type: "text", text: JSON.stringify({ risks }) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    );
    return;
  }
  res.writeHead(404).end();
});

server.listen(PORT, () => {
  console.log(`mock anthropic server listening on ${PORT}`);
});
