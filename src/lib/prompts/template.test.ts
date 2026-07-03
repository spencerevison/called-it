import { describe, expect, it } from "vitest";
import { loadPromptTemplate, renderTemplate } from "./template";

describe("renderTemplate", () => {
  it("substitutes simple variables", () => {
    expect(renderTemplate("Hello {{name}}!", { name: "World" })).toBe("Hello World!");
  });

  it("renders a list section per item", () => {
    const out = renderTemplate("{{#items}}- {{label}}\n{{/items}}", {
      items: [{ label: "a" }, { label: "b" }],
    });
    expect(out).toBe("- a\n- b\n");
  });

  it("renders a boolean-guarded fragment only when truthy", () => {
    const template = "{{#items}}{{label}}{{#desired}} (yes){{/desired}}\n{{/items}}";
    const out = renderTemplate(template, {
      items: [{ label: "a", desired: true }, { label: "b", desired: false }],
    });
    expect(out).toBe("a (yes)\nb\n");
  });

  it("drops unknown variables to empty string", () => {
    expect(renderTemplate("x{{missing}}y", {})).toBe("xy");
  });
});

describe("loadPromptTemplate", () => {
  it("parses the premortem_v1 prompt file into model/system/user", async () => {
    const template = await loadPromptTemplate("premortem_v1");
    expect(template.model).toBe("claude-sonnet-5");
    expect(template.system).toContain("prospective hindsight");
    expect(template.system).toContain("6–12 distinct failure modes");
    expect(template.user).toContain("DECISION RECORD");
    expect(template.user).toContain("{{title}}");
  });
});
