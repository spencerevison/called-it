import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const insertSingle = vi.fn();
const fetchSingle = vi.fn();
const updateEq = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: insertSingle })) })),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: fetchSingle })) })),
      update: vi.fn(() => ({ eq: updateEq })),
    })),
  })),
}));

function buildFormData(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      value.forEach((v) => fd.append(key, v));
    } else {
      fd.set(key, value);
    }
  }
  return fd;
}

describe("createDecision / updateDecision", () => {
  beforeEach(() => {
    getUser.mockReset();
    insertSingle.mockReset();
    fetchSingle.mockReset();
    updateEq.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  describe("createDecision", () => {
    it("rejects a missing title", async () => {
      const { createDecision } = await import("./actions");
      const result = await createDecision(
        buildFormData({ title: "", context: "ctx", options: ["a"] }),
      );
      expect(result).toEqual({ ok: false, errors: ["Title is required."] });
    });

    it("rejects zero options", async () => {
      const { createDecision } = await import("./actions");
      const result = await createDecision(buildFormData({ title: "t", context: "ctx" }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors).toContain("At least one option is required.");
    });

    it("rejects a chosen_option not present in options", async () => {
      const { createDecision } = await import("./actions");
      const result = await createDecision(
        buildFormData({
          title: "t",
          context: "ctx",
          options: ["a", "b"],
          chosen_option: "c",
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain("Chosen option must be one of the listed options.");
      }
    });

    it("requires an authenticated user", async () => {
      getUser.mockResolvedValue({ data: { user: null } });
      const { createDecision } = await import("./actions");
      const result = await createDecision(
        buildFormData({ title: "t", context: "ctx", options: ["a"] }),
      );
      expect(result).toEqual({ ok: false, errors: ["Not signed in."] });
    });

    it("persists a valid draft and returns its id", async () => {
      insertSingle.mockResolvedValue({ data: { id: "d1" }, error: null });
      const { createDecision } = await import("./actions");
      const result = await createDecision(
        buildFormData({
          title: "t",
          context: "ctx",
          options: ["a", "b"],
          chosen_option: "a",
          stakes: "high",
          reversibility: "one_way",
        }),
      );
      expect(result).toEqual({ ok: true, id: "d1" });
    });
  });

  describe("updateDecision", () => {
    it("treats another user's decision as not found", async () => {
      fetchSingle.mockResolvedValue({ data: { user_id: "other", status: "draft" }, error: null });
      const { updateDecision } = await import("./actions");
      const result = await updateDecision(
        "d1",
        buildFormData({ title: "t", context: "ctx", options: ["a"] }),
      );
      expect(result).toEqual({ ok: false, errors: ["Decision not found."] });
    });

    it("blocks edits once the decision is no longer a draft", async () => {
      fetchSingle.mockResolvedValue({ data: { user_id: "u1", status: "active" }, error: null });
      const { updateDecision } = await import("./actions");
      const result = await updateDecision(
        "d1",
        buildFormData({ title: "t", context: "ctx", options: ["a"] }),
      );
      expect(result).toEqual({ ok: false, errors: ["Only draft decisions can be edited."] });
    });

    it("updates an owned draft", async () => {
      fetchSingle.mockResolvedValue({ data: { user_id: "u1", status: "draft" }, error: null });
      updateEq.mockResolvedValue({ error: null });
      const { updateDecision } = await import("./actions");
      const result = await updateDecision(
        "d1",
        buildFormData({ title: "t", context: "ctx", options: ["a"], chosen_option: "a" }),
      );
      expect(result).toEqual({ ok: true, id: "d1" });
    });
  });
});
