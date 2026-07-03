// guards the auth `next` redirect param against open-redirect bypasses
// (//evil.com, https://evil.com, /\evil.com, https:evil.com) — see docs/EVIDENCE.md
// for the prior naive prefix-check that let /\evil.com through.
const BASE = "http://localhost";

export function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/";

  try {
    const url = new URL(raw, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
