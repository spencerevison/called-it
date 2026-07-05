import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { sendDueNotification } from "./due-notification";

function buildClient(opts: { title?: string | null; email?: string | null } = {}) {
  const maybeSingle = vi.fn(async () => ({
    data: opts.title === undefined ? { title: "Take the new job" } : opts.title === null ? null : { title: opts.title },
    error: null,
  }));

  return {
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })),
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({
          data: opts.email === undefined ? { user: { email: "user@example.com" } } : { user: opts.email ? { email: opts.email } : null },
        })),
      },
    },
  } as unknown as Parameters<typeof sendDueNotification>[0];
}

describe("sendDueNotification", () => {
  const prevKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    send.mockClear();
    process.env.RESEND_API_KEY = "test_key";
  });

  afterAll(() => {
    process.env.RESEND_API_KEY = prevKey;
  });

  it("is a no-op when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    await sendDueNotification(buildClient(), "c1", "d1", "u1");
    expect(send).not.toHaveBeenCalled();
  });

  it("sends an email with the decision title and a link", async () => {
    await sendDueNotification(buildClient(), "c1", "d1", "u1");

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.to).toBe("user@example.com");
    expect(payload.subject).toContain("Take the new job");
    expect(payload.html).toContain("/decisions/d1");
  });

  it("escapes a decision title containing HTML", async () => {
    await sendDueNotification(buildClient({ title: "<script>alert(1)</script>" }), "c1", "d1", "u1");

    const payload = send.mock.calls[0][0];
    expect(payload.html).not.toContain("<script>");
    expect(payload.html).toContain("&lt;script&gt;");
  });

  it("skips sending when the decision row is missing", async () => {
    await sendDueNotification(buildClient({ title: null }), "c1", "d1", "u1");
    expect(send).not.toHaveBeenCalled();
  });

  it("skips sending when the user has no email", async () => {
    await sendDueNotification(buildClient({ email: null }), "c1", "d1", "u1");
    expect(send).not.toHaveBeenCalled();
  });
});
